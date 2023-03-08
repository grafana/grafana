package dashboard

import "strconv"

type entityAnnotations struct {
	OrgID   int64
	Message string

	// General
	CreatedBy int64
	CreatedAt int64
	UpdatedBy int64
	UpdatedAt int64
	FolderID  int64 // can we skip this and lookup?
	FolderUID string

	// Provisioning
	PluginID   string
	OriginName string
	OriginPath string
	OriginKey  string
	OriginTime int64
}

const keyOrgID = "orgID"
const keyCreatedBy = "createdBy"
const keyCreatedAt = "createdAt"
const keyUpdatedBy = "updatedBy"
const keyUpdatedAt = "updatedAt"
const keyMessage = "message"
const keyPluginID = "plugin"
const keyFolderID = "folderID"
const keyFolderUID = "folderUID"
const keyOriginName = "originName"
const keyOriginPath = "originPath"
const keyOriginKey = "originKey"
const keyOriginTime = "originTime"

func (a *entityAnnotations) Merge(anno map[string]string) {
	tmp := make(map[string]string)
	m := a.ToMap() // Only the ones we should keep
	for k, v := range anno {
		if v == "" || m[k] != "" {
			continue
		}
		tmp[k] = v
	}
	a.Read(tmp)
}

func (a *entityAnnotations) Read(anno map[string]string) {
	a.Message = anno[keyMessage]
	a.PluginID = anno[keyPluginID]
	a.FolderUID = anno[keyFolderUID]
	a.OriginName = anno[keyOriginName]
	a.OriginPath = anno[keyOriginPath]
	a.OriginKey = anno[keyOriginKey]

	if v, ok := anno[keyOrgID]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			a.OrgID = p
		}
	}

	if v, ok := anno[keyCreatedBy]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			a.CreatedBy = p
		}
	}

	if v, ok := anno[keyCreatedAt]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			a.CreatedAt = p
		}
	}

	if v, ok := anno[keyUpdatedBy]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			a.UpdatedBy = p
		}
	}

	if v, ok := anno[keyUpdatedAt]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			a.UpdatedAt = p
		}
	}

	if v, ok := anno[keyFolderID]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			a.FolderID = p
		}
	}

	if v, ok := anno[keyOriginTime]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			a.OriginTime = p
		}
	}
}

func (a *entityAnnotations) ToMap() map[string]string {
	anno := map[string]string{}
	if a.OrgID > 0 {
		anno[keyOrgID] = strconv.FormatInt(a.OrgID, 10)
	}
	if a.Message != "" {
		anno[keyMessage] = a.Message
	}
	if a.CreatedAt > 0 {
		anno[keyCreatedAt] = strconv.FormatInt(a.CreatedAt, 10)
	}
	if a.CreatedBy > 0 {
		anno[keyCreatedBy] = strconv.FormatInt(a.CreatedBy, 10)
	}
	if a.UpdatedAt > 0 {
		anno[keyUpdatedAt] = strconv.FormatInt(a.UpdatedAt, 10)
	}
	if a.UpdatedBy > 0 {
		anno[keyUpdatedBy] = strconv.FormatInt(a.UpdatedBy, 10)
	}
	if a.FolderID > 0 {
		anno[keyFolderID] = strconv.FormatInt(a.FolderID, 10)
	}
	if a.FolderUID != "" {
		anno[keyFolderUID] = a.FolderUID
	}
	if a.PluginID != "" {
		anno[keyPluginID] = a.PluginID
	}
	if a.OriginName != "" {
		anno[keyOriginName] = a.OriginName
	}
	if a.OriginPath != "" {
		anno[keyOriginPath] = a.OriginPath
	}
	if a.OriginKey != "" {
		anno[keyOriginKey] = a.OriginKey
	}
	if a.OriginTime > 0 {
		anno[keyOriginTime] = strconv.FormatInt(a.OriginTime, 10)
	}
	return anno
}
