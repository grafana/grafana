package ofrep

import (
	"net/http"

	goffmodel "github.com/thomaspoignant/go-feature-flag/cmd/relayproxy/model"
)

func (b *APIBuilder) evalAllFlagsStatic(isAuthedUser bool, w http.ResponseWriter, r *http.Request) {
	result, err := b.staticEvaluator.EvalAllFlags(r.Context())
	if err != nil {
		b.logger.Error("Failed to evaluate all static flags", "error", err)
		http.Error(w, "failed to evaluate flags", http.StatusInternalServerError)
		return
	}

	if !isAuthedUser {
		var publicOnly []goffmodel.OFREPFlagBulkEvaluateSuccessResponse

		for _, flag := range result.Flags {
			if isPublicFlag(flag.Key) {
				publicOnly = append(publicOnly, flag)
			}
		}

		result.Flags = publicOnly
	}

	writeResponse(http.StatusOK, result, b.logger, w)
}

func (b *APIBuilder) evalFlagStatic(flagKey string, w http.ResponseWriter, r *http.Request) {
	result, err := b.staticEvaluator.EvalFlag(r.Context(), flagKey)
	if err != nil {
		b.logger.Error("Failed to evaluate static flag", "key", flagKey, "error", err)
		http.Error(w, "failed to evaluate flag", http.StatusInternalServerError)
		return
	}

	writeResponse(http.StatusOK, result, b.logger, w)
}
