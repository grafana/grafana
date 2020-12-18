package notifiers

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "matrix",
		Name:        "Matrix",
		Description: "Sends alert to Matrix",
		Heading:     "Matrix settings",
		Factory:     NewMatrixNotifier,
		Options: []alerting.NotifierOption{
			{
				Label:        "Matrix homeserver Url",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "https://matrix.org:8448",
				PropertyName: "homeserverUrl",
				Required:     true,
			},
			{
				Label:        "Access Token",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypePassword,
				Description:  "Access Token can be generated using the instruction here: https://matrix.org/docs/guides/client-server-api#login",
				PropertyName: "accessToken",
				Secure:       true,
				Required:     true,
			},
			{
				Label:        "Recipient",
				Element:      alerting.ElementTypeInput,
				InputType:    alerting.InputTypeText,
				Placeholder:  "!roomid:homeservername",
				PropertyName: "recipient",
				Required:     true,
			},
		},
	})
}

// NewMatrixNotifier returns a new Matrix notifier
func NewMatrixNotifier(model *models.AlertNotification) (alerting.Notifier, error) {
	homeserverURL := model.Settings.Get("homeserverUrl").MustString()
	if homeserverURL == "" {
		return nil, alerting.ValidationError{Reason: "Could not find homeserver URL property in settings"}
	}

	recipient := model.Settings.Get("recipient").MustString()
	if recipient == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Recipient property in settings"}
	}

	accessToken := model.DecryptedValue("accessToken", model.Settings.Get("accessToken").MustString())
	if accessToken == "" {
		return nil, alerting.ValidationError{Reason: "Could not find Access Token property in settings"}
	}

	return &MatrixNotifier{
		NotifierBase:  NewNotifierBase(model),
		HomeserverURL: homeserverURL,
		Recipient:     recipient,
		AccessToken:   accessToken,
		log:           log.New("alerting.notifier.matrix"),
	}, nil
}

// MatrixNotifier sends alert notifications to the alert manager
type MatrixNotifier struct {
	NotifierBase
	HomeserverURL string
	Recipient     string
	AccessToken   string
	log           log.Logger
}

// Notify send alert notification to Matrix.
func (mn *MatrixNotifier) Notify(evalContext *alerting.EvalContext) error {
	mn.log.Info("Executing matrix notification", "ruleId", evalContext.Rule.ID, "notification", mn.Name)
	ruleURL, err := evalContext.GetRuleURL()
	if err != nil {
		mn.log.Error("Failed get rule link", "error", err)
		return err
	}

	formattedBody := "<strong><a href='" + ruleURL + "'>" + evalContext.GetNotificationTitle() + "</a></strong>"
	formattedBody += "<blockquote data-mx-border-color='" + evalContext.GetStateModel().Color + "'>"

	for _, evt := range evalContext.EvalMatches {
		formattedBody += "<b>" + evt.Metric + "</b><br/>" + evt.Value.FullString() + "<br/>"
	}

	if evalContext.Error != nil {
		formattedBody += "<b>Error message</b><br/>" + evalContext.Error.Error() + "<br/>"
	}

	if evalContext.Rule.State != models.AlertStateOK { // don't add message when going back to alert state ok.
		formattedBody += evalContext.Rule.Message
	}

	formattedBody += "</blockquote>"

	imageURL := evalContext.ImagePublicURL
	if mn.NeedsImage() && imageURL != "" {
		MXCImage, err := uploadImageToMatrix(imageURL, mn)
		if err == nil {
			formattedBody += "<img src='" + MXCImage + "' alt='Failed to load image'><br/>"
		}
	}

	payload := map[string]interface{}{
		"formatted_body": formattedBody,
		"body":           "",
		"msgtype":        "m.text",
		"format":         "org.matrix.custom.html",
	}

	data, err := json.Marshal(&payload)
	if err != nil {
		return err
	}

	cmd := &models.SendWebhookSync{
		Url:        mn.HomeserverURL + "/_matrix/client/r0/rooms/" + mn.Recipient + "/send/m.room.message?access_token=" + mn.AccessToken,
		Body:       string(data),
		HttpMethod: http.MethodPost,
	}

	if err := bus.DispatchCtx(evalContext.Ctx, cmd); err != nil {
		mn.log.Error("Failed to send matrix notification", "error", err, "webhook", mn.Name)
		return err
	}

	return nil
}

// Images should be uploaded to the marix before sending the image
func uploadImageToMatrix(imageURL string, mn *MatrixNotifier) (string, error) {
	dashboardImage, err := http.Get(imageURL)

	if err == nil {
		defer func() {
			if err := dashboardImage.Body.Close(); err != nil {
				mn.log.Error("Failed to get dashboard image", "error", err, "webhook", mn.Name)
			}
		}()
		var data bytes.Buffer
		_, err := io.Copy(&data, dashboardImage.Body)
		if err == nil {
			matrixUploadURL := mn.HomeserverURL + "/_matrix/media/r0/upload?access_token=" + mn.AccessToken
			request, _ := http.NewRequest("POST", matrixUploadURL, &data)
			request.Header.Set("Content-Type", "image/png")

			client := &http.Client{}
			response, err := client.Do(request)
			if err == nil {
				defer func() {
					if err := response.Body.Close(); err != nil {
						mn.log.Error("Failed to upload dashboard image to matrix", "error", err, "webhook", mn.Name)
					}
				}()
				body, err := ioutil.ReadAll(response.Body)
				if err == nil {
					content := make(map[string]string)
					err := json.Unmarshal(body, &content)
					if err == nil {
						return content["content_uri"], nil
					}
				}
			}
		}
	}

	return "", err
}
