package main

import (
	"fmt"
	"math/rand"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/afiskon/promtail-client/promtail"
)
func main() {
   message := []string{
      "level=debug msg=\"[resolver] \\nreceived AAAA record \"::1\"",
      "Line with ANSI \u001B[31mlorem \\n ipsum\u001B[0m et dolor",
      "Line with newline before \n after",
      "level=debug msg=\"[resolver] received AAAA record \"::1\" traceID=3b8496f91e044c34",
      "level=debug msg=\"[resolver] received AAAA record \"::1\" for \"localhost.\" from udp:192.168.65.1\"",
   }
   quitChan := make(chan os.Signal, 1)
   signal.Notify(quitChan, syscall.SIGINT, syscall.SIGUSR1, syscall.SIGUSR2)
   clients := []promtail.Client{
      getClient("test_application"),
      getClient("test_application2"),
   }
   for {
      select {
      case <-quitChan:
         os.Exit(1)
      case <-time.After(1000 * time.Millisecond):
         n := rand.Intn(2)
         clients[n].Infof("n=\"%v\", message=\"%s\"", n, message[rand.Intn(len(message) - 1)])
         //clients[0].Infof("message=\"%s\"", message[rand.Intn(len(message) - 1)])
         //clients[1].Infof("message=\"%s\"", message[rand.Intn(len(message) - 1)])
      }
   }
}
func getClient(source string) promtail.Client {
   labels := fmt.Sprintf(`{source="%s", job="log", job_name="run_log"}`, source)
   conf := promtail.ClientConfig{
      PushURL:            "http://localhost:3100/api/prom/push",
      Labels:             labels,
      BatchWait:          1 * time.Second,
      BatchEntriesNumber: 1000,
      SendLevel:          promtail.INFO,
      PrintLevel:         promtail.INFO,
   }
   loki, err := promtail.NewClientJson(conf)
   if err != nil {
      fmt.Println(err)
      os.Exit(1)
   }
   return loki
}