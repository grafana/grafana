package api

import (
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// Silence-specific compat functions to convert between API and model types.

func GettableSilenceToAPIGettableSilence(s models.Silence) definitions.GettableSilence {
	return definitions.GettableSilence(s)
}

func GettableSilencesToAPIGettableSilences(silences []*models.Silence) definitions.GettableSilences {
	res := make(definitions.GettableSilences, 0, len(silences))
	for _, sil := range silences {
		apiSil := GettableSilenceToAPIGettableSilence(*sil)
		res = append(res, &apiSil)
	}
	return res
}

func PostableSilenceToModelPostableSilence(s definitions.PostableSilence) models.Silence {
	return models.Silence{
		ID:        &s.ID,
		Status:    nil,
		UpdatedAt: nil,
		Silence:   s.Silence,
	}
}
