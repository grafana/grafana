package export

import (
	"encoding/json"
	"fmt"
	"os"
	"path"
	"path/filepath"
)

func exportUsers(helper *commitHelper, job *gitExportJob) error {
	authDir := path.Join(helper.baseDir, "auth")
	userDir := path.Join(authDir, "users")
	teamsDir := path.Join(authDir, "teams")
	_ = os.MkdirAll(userDir, 0750)
	_ = os.MkdirAll(teamsDir, 0750)

	for _, user := range helper.users {
		clean, _ := json.MarshalIndent(user, "", "  ")
		helper.add(commitOptions{
			fpath:   filepath.Join(userDir, fmt.Sprintf("%s.json", user.Login)),
			body:    clean,
			when:    user.Created,
			comment: fmt.Sprintf("add user: %d", user.ID),
			userID:  user.ID,
		})
	}
	return nil
}
