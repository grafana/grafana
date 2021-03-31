package notifier

import (
	"fmt"
	"sort"
	"time"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/pkg/errors"
	v2 "github.com/prometheus/alertmanager/api/v2"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/alertmanager/silence"
	"github.com/prometheus/alertmanager/silence/silencepb"
	"github.com/prometheus/alertmanager/types"
)

var (
	// Taken from https://github.com/prometheus/alertmanager/blob/9ab7cef7510e66c2f38775e76c758165133b9536/api/v2/api.go#L527-L533
	silenceStateOrder = map[types.SilenceState]int{
		types.SilenceStateActive:  1,
		types.SilenceStatePending: 2,
		types.SilenceStateExpired: 3,
	}

	ErrGetSilencesInternal     = errors.New("unable to retrieve silence(s) due to an internal error")
	ErrDeleteSilenceInternal   = errors.New("unable to delete silence due to an internal error")
	ErrCreateSilenceBadPayload = errors.New("unable to create silence")
	ErrListSilencesBadPayload  = errors.New("unable to list silences")
	ErrSilenceNotFound         = silence.ErrNotFound
)

// ListSilences retrieves a list of stored silences. It supports a set of labels as filters.
func (am *Alertmanager) ListSilences(filters []string) (apimodels.GettableSilences, error) {
	matchers := []*labels.Matcher{}
	for _, matcherString := range filters {
		matcher, err := labels.ParseMatcher(matcherString)
		if err != nil {
			am.logger.Error("failed to parse matcher", "err", err, "matcher", matcherString)
			return nil, errors.Wrap(ErrListSilencesBadPayload, err.Error())
		}

		matchers = append(matchers, matcher)
	}

	psils, _, err := am.silences.Query()
	if err != nil {
		am.logger.Error(ErrGetSilencesInternal.Error(), "err", err)
		return nil, errors.Wrap(ErrGetSilencesInternal, err.Error())
	}

	sils := apimodels.GettableSilences{}
	for _, ps := range psils {
		if !v2.CheckSilenceMatchesFilterLabels(ps, matchers) {
			continue
		}
		silence, err := v2.GettableSilenceFromProto(ps)
		if err != nil {
			am.logger.Error("unmarshaling from protobuf failed", "err", err)
			return apimodels.GettableSilences{}, errors.Wrap(ErrGetSilencesInternal, fmt.Sprintf("failed to convert internal silence to API silence: %v", err.Error()))
		}
		sils = append(sils, &silence)
	}

	v2.SortSilences(sils)

	return sils, nil
}

// GetSilence retrieves a silence by the provided silenceID. It returns ErrSilenceNotFound if the silence is not present.
func (am *Alertmanager) GetSilence(silenceID string) (apimodels.GettableSilence, error) {
	sils, _, err := am.silences.Query(silence.QIDs(silenceID))
	if err != nil {
		return apimodels.GettableSilence{}, errors.Wrap(ErrGetSilencesInternal, err.Error())
	}

	if len(sils) == 0 {
		am.logger.Error("failed to find silence", "err", err, "id", sils)
		return apimodels.GettableSilence{}, ErrSilenceNotFound
	}

	sil, err := v2.GettableSilenceFromProto(sils[0])
	if err != nil {
		am.logger.Error("unmarshaling from protobuf failed", "err", err)
		return apimodels.GettableSilence{}, errors.Wrap(ErrGetSilencesInternal, fmt.Sprintf("failed to convert internal silence to API silence: %v", err.Error()))
	}

	return sil, nil
}

// CreateSilence persists the provided silence and returns the silence ID if successful.
func (am *Alertmanager) CreateSilence(ps *apimodels.PostableSilence) (string, error) {
	sil, err := v2.PostableSilenceToProto(ps)
	if err != nil {
		am.logger.Error("marshaling to protobuf failed", "err", err)
		return "", errors.Wrap(ErrCreateSilenceBadPayload, fmt.Sprintf("failed to convert API silence to internal silence: %v", err.Error()))
	}

	if sil.StartsAt.After(sil.EndsAt) || sil.StartsAt.Equal(sil.EndsAt) {
		msg := "start time must be before end time"
		am.logger.Error(msg, "err", "starts_at", sil.StartsAt, "ends_at", sil.EndsAt)
		return "", errors.Wrap(ErrCreateSilenceBadPayload, msg)
	}

	if sil.EndsAt.Before(time.Now()) {
		msg := "end time can't be in the past"
		am.logger.Error(msg, "ends_at", sil.EndsAt)
		return "", errors.Wrap(ErrCreateSilenceBadPayload, msg)
	}

	silenceID, err := am.silences.Set(sil)
	if err != nil {
		am.logger.Error("msg", "unable to save silence", "err", err)
		if errors.Is(err, silence.ErrNotFound) {
			return "", ErrSilenceNotFound
		}
		return "", errors.Wrap(ErrCreateSilenceBadPayload, fmt.Sprintf("unable to save silence: %v", err.Error()))
	}

	return silenceID, nil
}

// DeleteSilence looks for and expires the silence by the provided silenceID. It returns ErrSilenceNotFound if the silence is not present.
func (am *Alertmanager) DeleteSilence(silenceID string) error {
	if err := am.silences.Expire(silenceID); err != nil {
		if errors.Is(err, silence.ErrNotFound) {
			return ErrSilenceNotFound
		}
		return errors.Wrap(ErrDeleteSilenceInternal, err.Error())
	}

	return nil
}

// Taken from https://github.com/prometheus/alertmanager/blob/9ab7cef7510e66c2f38775e76c758165133b9536/api/v2/api.go#L565-L589
// checkSilenceMatchesFilterLabels returns true if
// a given silence matches a list of matchers.
// A silence matches a filter (list of matchers) if
// for all matchers in the filter, there exists a matcher in the silence
// such that their names, types, and values are equivalent.
func checkSilenceMatchesFilterLabels(s *silencepb.Silence, matchers []*labels.Matcher) bool {
	for _, matcher := range matchers {
		found := false
		for _, m := range s.Matchers {
			if matcher.Name == m.Name &&
				(matcher.Type == labels.MatchEqual && m.Type == silencepb.Matcher_EQUAL ||
					matcher.Type == labels.MatchRegexp && m.Type == silencepb.Matcher_REGEXP ||
					matcher.Type == labels.MatchNotEqual && m.Type == silencepb.Matcher_NOT_EQUAL ||
					matcher.Type == labels.MatchNotRegexp && m.Type == silencepb.Matcher_NOT_REGEXP) &&
				matcher.Value == m.Pattern {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	return true
}

// Taken from https://github.com/prometheus/alertmanager/blob/9ab7cef7510e66c2f38775e76c758165133b9536/api/v2/api.go#L535-L563
// sortSilences sorts first according to the state "active, pending, expired"
// then by end time or start time depending on the state.
// active silences should show the next to expire first
// pending silences are ordered based on which one starts next
// expired are ordered based on which one expired most recently
func sortSilences(sils apimodels.GettableSilences) {
	sort.Slice(sils, func(i, j int) bool {
		state1 := types.SilenceState(*sils[i].Status.State)
		state2 := types.SilenceState(*sils[j].Status.State)
		if state1 != state2 {
			return silenceStateOrder[state1] < silenceStateOrder[state2]
		}
		switch state1 {
		case types.SilenceStateActive:
			endsAt1 := time.Time(*sils[i].Silence.EndsAt)
			endsAt2 := time.Time(*sils[j].Silence.EndsAt)
			return endsAt1.Before(endsAt2)
		case types.SilenceStatePending:
			startsAt1 := time.Time(*sils[i].Silence.StartsAt)
			startsAt2 := time.Time(*sils[j].Silence.StartsAt)
			return startsAt1.Before(startsAt2)
		case types.SilenceStateExpired:
			endsAt1 := time.Time(*sils[i].Silence.EndsAt)
			endsAt2 := time.Time(*sils[j].Silence.EndsAt)
			return endsAt1.After(endsAt2)
		}
		return false
	})
}
