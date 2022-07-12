package correlations

import (
	"errors"
)

var (
	ErrSourceDataSourceReadOnly           = errors.New("source data source is read only")
	ErrSourceDataSourceDoesNotExists      = errors.New("source data source does not exist")
	ErrTargetDataSourceDoesNotExists      = errors.New("target data source does not exist")
	ErrCorrelationFailedGenerateUniqueUid = errors.New("failed to generate unique correlation UID")
	ErrCorrelationIdentifierNotSet        = errors.New("source identifier and org id are needed to be able to edit correlations")
)

// Correlation is the model for correlations definitions
type Correlation struct {
	ID          int64  `xorm:"pk autoincr 'id'"`
	UID         string `xorm:"uid"`
	SourceUID   string `xorm:"source_uid"`
	TargetUID   string `xorm:"target_uid"`
	Label       string `xorm:"label"`
	Description string `xorm:"description"`
}

type CorrelationDTO struct {
	UID         string `json:"uid" xorm:"uid"`
	SourceUID   string `json:"sourceUid"`
	TargetUID   string `json:"targetUid"`
	Label       string `json:"label"`
	Description string `json:"description"`
}

// CreateCorrelationResponse is a response struct for CorrelationDTO
type CreateCorrelationResponse struct {
	Result CorrelationDTO `json:"result"`
}

// CreateCorrelationCommand is the command for creating a correlation
// swagger:model
type CreateCorrelationCommand struct {
	// UID of the data source for which correlation is created.
	// example: PE1C5CBDA0504A6A3
	SourceUID   string
	OrgId       int64
	TargetUID   string `json:"targetUid" binding:"Required"`
	Label       string `json:"label"`
	Description string `json:"description"`
}

type DeleteCorrelationsBySourceUIDCommand struct {
	SourceUID string
}
