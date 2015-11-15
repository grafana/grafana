package alert

import (

  "github.com/wangy1931/grafana/pkg/bus"
)

func Init() {
  bus.AddHandler("alert", AlertSourceUrl)
}

func AlertSourceUrl() {

}
