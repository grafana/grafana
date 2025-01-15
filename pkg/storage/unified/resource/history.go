package resource

import (
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type HistoryRequest struct {
	Key *ResourceKey

	// Deleted items within this kind
	Trash bool

	// Start the query
	NextPageToken string
}

func GetHistoryRequest(list *ListRequest) (*HistoryRequest, error) {
	for _, v := range list.Options.Labels {
		if v.Key == utils.LabelKeyGetHistory || v.Key == utils.LabelKeyGetTrash {
			if len(list.Options.Labels) != 1 {
				return nil, apierrors.NewBadRequest("single label supported with: " + v.Key)
			}
			if len(list.Options.Fields) > 0 {
				return nil, apierrors.NewBadRequest("field selector not supported with: " + v.Key)
			}
			if v.Operator != "=" {
				return nil, apierrors.NewBadRequest("only = operator supported with: " + v.Key)
			}
			if len(v.Values) != 1 {
				return nil, apierrors.NewBadRequest("expecting single value for: " + v.Key)
			}

			req := &HistoryRequest{
				Key:           list.Options.Key,
				Trash:         v.Key == utils.LabelKeyGetTrash,
				NextPageToken: list.NextPageToken,
			}
			if req.Trash {
				if v.Values[0] != "true" {
					return nil, apierrors.NewBadRequest("expecting true for: " + v.Key)
				}
			} else {
				req.Key.Name = v.Values[0]
			}

			return req, nil
		}
	}
	return nil, nil
}
