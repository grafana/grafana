package notifications

import "github.com/grafana/grafana/pkg/bus"

func Init() {
	bus.AddHandler("email", sendResetPasswordEmail)
}

func sendResetPasswordEmail(cmd *SendResetPasswordEmailCommand) error {
	return nil
}
