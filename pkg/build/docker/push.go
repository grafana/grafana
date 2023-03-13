package docker

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"time"
)

const (
	tries     = 3
	sleepTime = 30
)

func PushImage(newImage string) error {
	var err error
	for i := 0; i < tries; i++ {
		log.Printf("push attempt #%d...", i+1)
		var out []byte
		cmd := exec.Command("docker", "push", newImage)
		cmd.Dir = "."
		out, err = cmd.CombinedOutput()
		if err != nil {
			log.Printf("output: %s", out)
			log.Printf("sleep for %d, before retrying...", sleepTime)
			time.Sleep(sleepTime * time.Second)
		} else {
			log.Printf("Successfully pushed %s!", newImage)
			break
		}
	}
	if err != nil {
		return fmt.Errorf("error pushing images to DockerHub: %q", err)
	}
	return nil
}

func PushManifest(manifest string) error {
	log.Printf("Pushing Docker manifest %s...", manifest)

	var err error
	for i := 0; i < tries; i++ {
		log.Printf("push attempt #%d...", i+1)
		var out []byte
		cmd := exec.Command("docker", "manifest", "push", manifest)
		cmd.Env = append(os.Environ(), "DOCKER_CLI_EXPERIMENTAL=enabled")
		out, err = cmd.CombinedOutput()
		if err != nil {
			log.Printf("output: %s", out)
			log.Printf("sleep for %d, before retrying...", sleepTime)
			time.Sleep(sleepTime * time.Second)
		} else {
			log.Printf("Successful manifest push! %s", string(out))
			break
		}
	}
	if err != nil {
		return fmt.Errorf("failed to push manifest, err: %w", err)
	}
	return nil
}
