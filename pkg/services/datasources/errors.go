package datasources

import (
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	ErrDataSourceNotFound                = errors.New("data source not found")
	ErrDataSourceNameExists              = errors.New("data source with the same name already exists")
	ErrDataSourceUidExists               = errors.New("data source with the same uid already exists")
	ErrDataSourceUpdatingOldVersion      = errors.New("trying to update old version of datasource")
	ErrDataSourceAccessDenied            = errors.New("data source access denied")
	ErrDataSourceFailedGenerateUniqueUid = errors.New("failed to generate unique datasource ID")
	ErrDataSourceIdentifierNotSet        = errors.New("unique identifier and org id are needed to be able to get or delete a datasource")
	ErrDatasourceIsReadOnly              = errors.New("data source is readonly, can only be updated from configuration")
	ErrDataSourceNameInvalid             = errutil.ValidationFailed("datasource.nameInvalid", errutil.WithPublicMessage("Invalid datasource name."))
	ErrDataSourceURLInvalid              = errutil.ValidationFailed("datasource.urlInvalid", errutil.WithPublicMessage("Invalid datasource url."))
	ErrDataSourceAPIVersionInvalid       = errutil.ValidationFailed("datasource.apiVersionInvalid", errutil.WithPublicMessage("Invalid datasource apiVersion."))
	ErrDataSourceUIDInvalid              = errutil.ValidationFailed("datasource.uidInvalid", errutil.WithPublicMessage("Invalid datasource UID."))
)
