package correlations

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/quota"
)

var (
	ErrSourceDataSourceReadOnly           = errors.New("source data source is read only")
	ErrSourceDataSourceDoesNotExists      = errors.New("source data source does not exist")
	ErrTargetDataSourceDoesNotExists      = errors.New("target data source does not exist")
	ErrCorrelationFailedGenerateUniqueUid = errors.New("failed to generate unique correlation UID")
	ErrCorrelationNotFound                = errors.New("correlation not found")
	ErrUpdateCorrelationEmptyParams       = errors.New("not enough parameters to edit correlation")
	ErrInvalidConfigType                  = errors.New("invalid correlation config type")
	ErrInvalidTransformationType          = errors.New("invalid transformation type")
	ErrTransformationNotNested            = errors.New("transformations must be nested under config")
	ErrTransformationRegexReqExp          = errors.New("regex transformations require expression")
	ErrCorrelationsQuotaFailed            = errors.New("error getting correlations quota")
	ErrCorrelationsQuotaReached           = errors.New("correlations quota reached")
)

const (
	QuotaTargetSrv quota.TargetSrv = "correlations"
	QuotaTarget    quota.Target    = "correlations"
)

type CorrelationConfigType string

type Transformation struct {
	//Enum: regex,logfmt
	Type       string `json:"type"`
	Expression string `json:"expression,omitempty"`
	Field      string `json:"field,omitempty"`
	MapValue   string `json:"mapValue,omitempty"`
}

const (
	ConfigTypeQuery CorrelationConfigType = "query"
)

func (t CorrelationConfigType) Validate() error {
	if t != ConfigTypeQuery {
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
	// required:true
	Type CorrelationConfigType `json:"type" binding:"Required"`
	// Target data query
	// required:true
	// example: { "expr": "job=app" }
	Target map[string]interface{} `json:"target" binding:"Required"`
	// Source data transformations
	// required:false
	// example: [{"type": "logfmt"}]
	Transformations Transformations `json:"transformations,omitempty"`
}

func (c CorrelationConfig) MarshalJSON() ([]byte, error) {
	target := c.Target
	transformations := c.Transformations
	if target == nil {
		target = map[string]interface{}{}
	}
	return json.Marshal(struct {
		Type            CorrelationConfigType  `json:"type"`
		Field           string                 `json:"field"`
		Target          map[string]interface{} `json:"target"`
		Transformations Transformations        `json:"transformations,omitempty"`
	}{
		Type:            ConfigTypeQuery,
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
	// example:d0oxYRg4z
	SourceUID string `json:"sourceUID" xorm:"pk 'source_uid'"`
	// UID of the data source the correlation points to
	// example:PE1C5CBDA0504A6A3
	TargetUID *string `json:"targetUID" xorm:"target_uid"`
	// Label identifying the correlation
	// example: My Label
	Label string `json:"label" xorm:"label"`
	// Description of the correlation
	// example: Logs to Traces
	Description string `json:"description" xorm:"description"`
	// Correlation Configuration
	Config CorrelationConfig `json:"config" xorm:"jsonb config"`
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
	SourceUID         string `json:"-"`
	OrgId             int64  `json:"-"`
	SkipReadOnlyCheck bool   `json:"-"`
	// Target data source UID to which the correlation is created. required if config.type = query
	// example:PE1C5CBDA0504A6A3
	TargetUID *string `json:"targetUID"`
	// Optional label identifying the correlation
	// example: My label
	Label string `json:"label"`
	// Optional description of the correlation
	// example: Logs to Traces
	Description string `json:"description"`
	// Arbitrary configuration object handled in frontend
	Config CorrelationConfig `json:"config" binding:"Required"`
}

func (c CreateCorrelationCommand) Validate() error {
	if err := c.Config.Type.Validate(); err != nil {
		return err
	}
	if c.TargetUID == nil && c.Config.Type == ConfigTypeQuery {
		return fmt.Errorf("correlations of type \"%s\" must have a targetUID", ConfigTypeQuery)
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
	// Target type
	Type *CorrelationConfigType `json:"type"`
	// Target data query
	// example: { "expr": "job=app" }
	Target *map[string]interface{} `json:"target"`
	// Source data transformations
	// example: [{"type": "logfmt"},{"type":"regex","expression":"(Superman|Batman)", "variable":"name"}]
	Transformations []Transformation `json:"transformations"`
}

func (c CorrelationConfigUpdateDTO) Validate() error {
	if c.Type != nil {
		if err := c.Type.Validate(); err != nil {
			return err
		}
	}

	return nil
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
}

func (c UpdateCorrelationCommand) Validate() error {
	if c.Config != nil {
		if err := c.Config.Validate(); err != nil {
			return err
		}
	}

	if c.Label == nil && c.Description == nil && (c.Config == nil || (c.Config.Field == nil && c.Config.Type == nil && c.Config.Target == nil)) {
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
	Limit int64 `json:"perpage"`
	// Page index for starting fetching correlations
	// in:query
	// required:false
	// default:1
	Page int64 `json:"page"`
}

type DeleteCorrelationsBySourceUIDCommand struct {
	SourceUID string
}

type DeleteCorrelationsByTargetUIDCommand struct {
	TargetUID string
}
