package notifiers

import (
	"bytes"
	"io"
	"os"
	"path/filepath"

	"fmt"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/mattermost/mattermost-server/model"
	"strings"
)

func init() {
	alerting.RegisterNotifier(&alerting.NotifierPlugin{
		Type:        "mattermost",
		Name:        "Mattermost",
		Description: "Sends notifications to Mattermost via Mattermost Webhooks",
		Factory:     NewMattermostNotifier,
		OptionsTemplate: `
      <h3 class="page-heading">Mattermost settings</h3>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Url</span>
        <input type="text" required class="gf-form-input max-width-30" ng-model="ctrl.model.settings.url" placeholder="Mattermost url"></input>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Chanel</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.recipient"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Chanel that will get notifications
        </info-popover>
      </div>
	  <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Team Name</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.team_name"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Team Name (Not displayName)
        </info-popover>
      </div>	
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Mention</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.mention"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Mention a user or a group using @ when notifying in a channel
        </info-popover>
      </div>
      <div class="gf-form max-width-30">
        <span class="gf-form-label width-6">Token</span>
        <input type="text"
          class="gf-form-input max-width-30"
          ng-model="ctrl.model.settings.token"
          data-placement="right">
        </input>
        <info-popover mode="right-absolute">
          Provide <a href="https://docs.mattermost.com/developer/personal-access-tokens.html">personal access token</a>
        </info-popover>
      </div>
    `,
	})

}

func NewMattermostNotifier(model *m.AlertNotification) (alerting.Notifier, error) {
	url := model.Settings.Get("url").MustString()
	if url == "" {
		return nil, alerting.ValidationError{Reason: "Could not find url property in settings"}
	}

	recipient := model.Settings.Get("recipient").MustString()
	teamName := model.Settings.Get("team_name").MustString()
	mention := model.Settings.Get("mention").MustString()
	token := model.Settings.Get("token").MustString()
	uploadImage := model.Settings.Get("uploadImage").MustBool(true)

	return &MattermostNotifier{
		NotifierBase: NewNotifierBase(model.Id, model.IsDefault, model.Name, model.Type, model.Settings),
		Url:          url,
		Recipient:    recipient,
		Mention:      mention,
		Token:        token,
		Upload:       uploadImage,
		TeamName:     teamName,
		log:          log.New("alerting.notifier.mattermost"),
	}, nil
}

type MattermostNotifier struct {
	NotifierBase
	Url       string
	Recipient string
	Mention   string
	Token     string
	Upload    bool
	log       log.Logger
	TeamName  string
}

func (this *MattermostNotifier) ShouldNotify(context *alerting.EvalContext) bool {
	return defaultShouldNotify(context)
}

var botTeam *model.Team
var channel *model.Channel

func (this *MattermostNotifier) Notify(evalContext *alerting.EvalContext) error {
	this.log.Info("Executing mattermost notification", "ruleId", evalContext.Rule.Id, "notification", this.Name)

	client := model.NewAPIv4Client(this.Url)
	client.AuthToken = this.Token
	client.AuthType = model.HEADER_BEARER

	if _, res := client.GetMe(""); res.Error != nil {
		this.log.Error("Can't authorize with given token", "error", res.Error)
		return res.Error
	}

	if err := this.FindTeam(client); err != nil {
		this.log.Error("Failed to find Team", "error", err)
		return err
	}

	if err := this.getChannelId(client); err != nil {
		this.log.Error("Failed to find channel", "error", err)
		return err
	}

	FileUploadResponse := &model.FileUploadResponse{}
	if this.UploadImage {
		if err, File := MattermostFileUpload(client, evalContext, this.log); err != nil {
			this.log.Error("Failed to upload image", "error", err)
			return err
		} else {
			FileUploadResponse = File
		}
	}

	post := &model.Post{}
	post.ChannelId = channel.Id
	post.Message, post.FileIds = prepareMessage(evalContext, client, this.Mention, FileUploadResponse)

	if _, resp := client.CreatePost(post); resp.Error != nil {
		println("We failed to send a message to the logging channel")
	}

	return nil
}

func prepareMessage(evalContext *alerting.EvalContext, client *model.Client4, Mention string, FileUploadResponse *model.FileUploadResponse) (string, []string) {
	FileIds := make([]string, 0)

	ruleUrl, err := evalContext.GetRuleUrl()
	if err != nil {
		ruleUrl = "#"
	}

	title := evalContext.GetNotificationTitle()
	titleTemplate := `### %s[%s](%s)%s` //emoji title emoji
	emoji := ""
	switch evalContext.Rule.State {
	case m.AlertStateAlerting:
		emoji = ":warning: "
		break
	case m.AlertStateOK:
		emoji = ":white_check_mark:"
		break
	case m.AlertStateNoData:
	case m.AlertStatePaused:
	case m.AlertStatePending:
		emoji = ":flushed:"
		break
	}
	titleMD := fmt.Sprintf(titleTemplate, emoji, title, ruleUrl, emoji)
	imageTemplate := `[![%s](%s%s)](%s)`
	imageMD := ""

	if FileUploadResponse.FileInfos != nil && len(FileUploadResponse.FileInfos) != 0 {
		FileIds = make([]string, len(FileUploadResponse.FileInfos))
		for i, v := range FileUploadResponse.FileInfos {
			FileIds[i] = v.Id
			imageMD += fmt.Sprintf(imageTemplate, title, client.ApiUrl, client.GetFileRoute(v.Id), ruleUrl)
		}
	}
	tableTemplate := "\n| Metric  | Value  |\n| :------ |:------:|\n%s"
	rowTemplate := "| %s | %s |\n"
	rows := ""
	for _, evt := range evalContext.EvalMatches {
		rows += fmt.Sprintf(rowTemplate, evt.Metric, evt.Value)
	}
	tableMD := fmt.Sprintf(tableTemplate, rows)
	errorNessage := ""
	if evalContext.Error != nil {
		errorNessage = fmt.Sprintf("#### Error message:\n%s\n", evalContext.Error.Error())
	}
	message := strings.Join([]string{titleMD, evalContext.Rule.Message, imageMD, tableMD, errorNessage, Mention}, "\n")
	return message, FileIds
}

func (this *MattermostNotifier) FindTeam(client *model.Client4) error {
	if team, resp := client.GetTeamByName(this.TeamName, ""); resp.Error != nil {
		this.log.Info("We failed to get the initial load")
		this.log.Info("or we do not appear to be a member of the team '" + this.TeamName + "'")
		return resp.Error
	} else {
		botTeam = team
	}
	return nil
}

func (this *MattermostNotifier) getChannelId(client *model.Client4) error {
	if rchannel, resp := client.GetChannelByName(this.Recipient, botTeam.Id, ""); resp.Error != nil {
		this.log.Info("We failed to get the channels")
		return resp.Error
	} else {
		channel = rchannel
		return nil
	}

}

func MattermostFileUpload(client *model.Client4, evalContext *alerting.EvalContext, log log.Logger) (error, *model.FileUploadResponse) {
	if evalContext.ImageOnDiskPath == "" {
		evalContext.ImageOnDiskPath = filepath.Join(setting.HomePath, "public/img/mixed_styles.png")
	}
	log.Info("Uploading to mattermost via file.upload API")

	file, err := os.Open(evalContext.ImageOnDiskPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
	}
	defer file.Close()
	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)
	data := buf.Bytes()

	if File, response := client.UploadFile(data, channel.Id, evalContext.ImageOnDiskPath); response.Error != nil {
		return response.Error, nil
	} else {
		return nil, File
	}
}
