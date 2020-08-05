package trigram

import "sort"

type SearchService struct {
	storage Store
}

type SearchResult struct {
	Resources []string
}

type TrigramKey struct {
	Trigram  string
	Resource string
	Type     string
}

type Store interface {
	Set(key TrigramKey, score float64) error
	Get(trigrams []string) (map[TrigramKey]float64, error)
}

func (s *SearchService) Search(phrase string) (SearchResult, error) {
	trigrams := FromString(phrase)
	scores, err := s.storage.Get(trigrams)
	if err != nil {
		return SearchResult{}, err
	}

	scoresByResource := map[string]float64{}
	for key, score := range scores {
		oldScore := scoresByResource[key.Resource]
		score = score + oldScore
		scoresByResource[key.Resource] = score
	}

	resources := make([]string, 0, len(scoresByResource))
	for key := range scoresByResource {
		resources = append(resources, key)
	}

	sort.Slice(resources, func(i, j int) bool {
		return scoresByResource[resources[i]] < scoresByResource[resources[j]]
	})

	return SearchResult{
		Resources: resources,
	}, nil
}
