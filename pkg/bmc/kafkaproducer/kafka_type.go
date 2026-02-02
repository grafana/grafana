package kafkaproducer

import (
	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"time"
)

type CreateAuditEvent struct {
	EventType   string `json:"event_type"`
	Description string `json:"description"`
	Data        Data   `json:"data"`
}
type EventTime time.Time

type Data struct {
	AuditCategory    string        `json:"audit_category,omitempty"`
	ObjectID         string        `json:"object_id,omitempty"`
	AppID            string        `json:"app_id,omitempty"`
	TenantID         string        `json:"tenant_id,omitempty"`
	ObjectName       string        `json:"object_name,omitempty"`
	ObjectType       string        `json:"object_type,omitempty"`
	ObjectCategory   string        `json:"object_category,omitempty"`
	ObjectDetails    string        `json:"object_details,omitempty"`
	Operation        string        `json:"operation,omitempty"`
	OperationType    string        `json:"operation_type,omitempty"`
	OperationSubType string        `json:"operation_sub_type,omitempty"`
	OperationStatus  string        `json:"operation_status,omitempty"`
	Description      string        `json:"description,omitempty"`
	ActorUserID      string        `json:"actor_user_id,omitempty"`
	ActorLoginID     string        `json:"actor_login_id,omitempty"`
	ActivityTime     EventTime     `json:"activity_time,omitempty"`
	TransactionID    string        `json:"transaction_id,omitempty"`
	Source           string        `json:"source,omitempty"`
	ChangeValues     *ChangeValues `json:"change_values,omitempty"`
}

type ChangeValues struct {
	PreviousValue *simplejson.Json `json:"previous_value,omitempty"`
	NewValue      *simplejson.Json `json:"new_value,omitempty"`
}

func (t EventTime) MarshalJSON() ([]byte, error) {
	formatted := time.Time(t).Format("2006-01-02T15:04:05.000Z")
	return []byte(fmt.Sprintf(`"%s"`, formatted)), nil
}
