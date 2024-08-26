package correlations

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/quota"
)

var (
	ErrCorrelationReadOnly           = errors.New("correlation can only be edited via provisioning")
	ErrSourceDataSourceDoesNotExists = errors.New("source data source does not exist")
	ErrTargetDataSourceDoesNotExists = errors.New("target data source does not exist")
	ErrCorrelationNotFound           = errors.New("correlation not found")
	ErrUpdateCorrelationEmptyParams  = errors.New("not enough parameters to edit correlation")
	ErrInvalidConfigType             = errors.New("invalid correlation config type")
	ErrInvalidTransformationType     = errors.New("invalid transformation type")
	ErrTransformationNotNested       = errors.New("transformations must be nested under config")
	ErrTransformationRegexReqExp     = errors.New("regex transformations require expression")
	ErrCorrelationsQuotaFailed       = errors.New("error getting correlations quota")
	ErrCorrelationsQuotaReached      = errors.New("correlations quota reached")
)

const (
	QuotaTargetSrv quota.TargetSrv = "correlations"
	QuotaTarget    quota.Target    = "correlations"
)

// the type of correlation, either query for containing query information, or external for containing an external URL
// +enum
type CorrelationType string

const (
	query    CorrelationType = "query"
	external CorrelationType = "external"
)

type Transformation struct {
	//Enum: regex,logfmt
	Type       string `json:"type"`
	Expression string `json:"expression,omitempty"`
	Field      string `json:"field,omitempty"`
	MapValue   string `json:"mapValue,omitempty"`
}

func (t CorrelationType) Validate() error {
	if (t != query && t != external) {
		return fmt.Errorf("%s: \"%s\"", ErrInvalidConfigType, t)
	}
	return nil
}

func (t Transformations) Validate() error {
	for _, v := range t {
		if v.Type != "regex" && v.Type != "logfmt" {
			return fmt.Errorf("%s: \"%s\"", ErrInvalidTransformationType, t)
		} else if v.Type == "regex" && len(v.Expression) == 0 {
			return fmt.Errorf("%s: \"%s\"", ErrTransformationRegexReqExp, t)
		}
	}
	return nil
}

type Transformations []Transformation

// swagger:model
type CorrelationConfig struct {
	// Field used to attach the correlation link
	// required:true
	// example: message
	Field string `json:"field" binding:"Required"`
	// Target type
	// This is deprecated: use the type property outside of config
	// deprecated:true
	Type CorrelationType `json:"type"`
	// Target data query
	// required:true
	// example: {"prop1":"value1","prop2":"value"}
	Target map[string]any `json:"target" binding:"Required"`
	// Source data transformations
	// required:false
	// example: [{"type":"logfmt"}]
	Transformations Transformations `json:"transformations,omitempty"`
}

func (c CorrelationConfig) MarshalJSON() ([]byte, error) {
	target := c.Target
	transformations := c.Transformations
	if target == nil {
		target = map[string]any{}
	}
	return json.Marshal(struct {
		Field           string          `json:"field"`
		Target          map[string]any  `json:"target"`
		Transformations Transformations `json:"transformations,omitempty"`
	}{
		Field:           c.Field,
		Target:          target,
		Transformations: transformations,
	})
}

// Correlation is the model for correlations definitions
// swagger:model
type Correlation struct {
	// Unique identifier of the correlation
	// example: 50xhMlg9k
	UID string `json:"uid" xorm:"pk 'uid'"`
	// UID of the data source the correlation originates from
	// example: d0oxYRg4z
	SourceUID string `json:"sourceUID" xorm:"pk 'source_uid'"`
	// OrgID of the data source the correlation originates from
	// Example: 1
	OrgID int64 `json:"orgId" xorm:"pk 'org_id'"`
	// UID of the data source the correlation points to
	// example: PE1C5CBDA0504A6A3
	TargetUID *string `json:"targetUID" xorm:"target_uid"`
	// Label identifying the correlation
	// example: My Label
	Label string `json:"label" xorm:"label"`
	// Description of the correlation
	// example: Logs to Traces
	Description string `json:"description" xorm:"description"`
	// Correlation Configuration
	Config CorrelationConfig `json:"config" xorm:"jsonb config"`
	// Provisioned True if the correlation was created during provisioning
	Provisioned bool `json:"provisioned"`
	// The type of correlation. Currently, only valid value is "query"
	Type CorrelationType `json:"type" binding:"Required"`
}

type GetCorrelationsResponseBody struct {
	Correlations []Correlation `json:"correlations"`
	TotalCount   int64         `json:"totalCount"`
	Page         int64         `json:"page"`
	Limit        int64         `json:"limit"`
}

// CreateCorrelationResponse is the response struct for CreateCorrelationCommand
// swagger:model
type CreateCorrelationResponseBody struct {
	Result Correlation `json:"result"`
	// example: Correlation created
	Message string `json:"message"`
}

// CreateCorrelationCommand is the command for creating a correlation
// swagger:model
type CreateCorrelationCommand struct {
	// UID of the data source for which correlation is created.
	SourceUID string `json:"-"`
	OrgId     int64  `json:"-"`
	// Target data source UID to which the correlation is created. required if type = query
	// example: PE1C5CBDA0504A6A3
	TargetUID *string `json:"targetUID"`
	// Optional label identifying the correlation
	// example: My label
	Label string `json:"label"`
	// Optional description of the correlation
	// example: Logs to Traces
	Description string `json:"description"`
	// Arbitrary configuration object handled in frontend
	Config CorrelationConfig `json:"config" binding:"Required"`
	// True if correlation was created with provisioning. This makes it read-only.
	Provisioned bool `json:"provisioned"`
	// correlation type, currently only valid value is "query"
	Type CorrelationType `json:"type" binding:"Required"`
}

func (c CreateCorrelationCommand) Validate() error {
	if err := c.Type.Validate(); err != nil {
		return err
	}
	if c.TargetUID == nil && c.Type == query {
		return fmt.Errorf("correlations of type \"%s\" must have a targetUID", query)
	}

	if err := c.Config.Transformations.Validate(); err != nil {
		return err
	}
	return nil
}

// swagger:model
type DeleteCorrelationResponseBody struct {
	// example: Correlation deleted
	Message string `json:"message"`
}

// DeleteCorrelationCommand is the command for deleting a correlation
type DeleteCorrelationCommand struct {
	// UID of the correlation to be deleted.
	UID       string
	SourceUID string
	OrgId     int64
}

// swagger:model
type UpdateCorrelationResponseBody struct {
	Result Correlation `json:"result"`
	// example: Correlation updated
	Message string `json:"message"`
}

// swagger:model
type CorrelationConfigUpdateDTO struct {
	// Field used to attach the correlation link
	// example: message
	Field *string `json:"field"`
	// Target data query
	// example: {"prop1":"value1","prop2":"value"}
	Target *map[string]any `json:"target"`
	// Source data transformations
	// example: [{"type": "logfmt"},{"type":"regex","expression":"(Superman|Batman)", "variable":"name"}]
	Transformations []Transformation `json:"transformations"`
}

// UpdateCorrelationCommand is the command for updating a correlation
// swagger:model
type UpdateCorrelationCommand struct {
	// UID of the correlation to be updated.
	UID       string `json:"-"`
	SourceUID string `json:"-"`
	OrgId     int64  `json:"-"`

	// Optional label identifying the correlation
	// example: My label
	Label *string `json:"label"`
	// Optional description of the correlation
	// example: Logs to Traces
	Description *string `json:"description"`
	// Correlation Configuration
	Config *CorrelationConfigUpdateDTO `json:"config"`
	// correlation type
	Type *CorrelationType `json:"type"`
}

func (c UpdateCorrelationCommand) Validate() error {
	if c.Label == nil && c.Description == nil && c.Type == nil && (c.Config == nil || (c.Config.Field == nil && c.Config.Target == nil)) {
		return ErrUpdateCorrelationEmptyParams
	}

	return nil
}

// GetCorrelationQuery is the query to retrieve a single correlation
type GetCorrelationQuery struct {
	// UID of the correlation
	UID string `json:"-"`
	// UID of the source data source
	SourceUID string `json:"-"`
	OrgId     int64  `json:"-"`
}

// GetCorrelationsBySourceUIDQuery is the query to retrieve all correlations originating by the given Data Source
type GetCorrelationsBySourceUIDQuery struct {
	SourceUID string `json:"-"`
	OrgId     int64  `json:"-"`
}

// GetCorrelationsQuery is the query to retrieve all correlations
type GetCorrelationsQuery struct {
	OrgId int64 `json:"-"`
	// Limit the maximum number of correlations to return per page
	// in:query
	// required:false
	// default:100
	Limit int64 `json:"limit"`
	// Page index for starting fetching correlations
	// in:query
	// required:false
	// default:1
	Page int64 `json:"page"`

	// Source datasource UID filter to be applied to correlations
	// in:query
	// required:false
	SourceUIDs []string `json:"sourceuid"`
}

type DeleteCorrelationsBySourceUIDCommand struct {
	SourceUID       string
	OrgId           int64
	OnlyProvisioned bool
}

type DeleteCorrelationsByTargetUIDCommand struct {
	TargetUID string
	OrgId     int64
}
