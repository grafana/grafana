package keystone

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
)

///////////////////////
// Json Structs
///////////////////////

// Auth Request
type auth_request_struct struct {
	Auth auth_struct `json:"auth"`
}

type auth_struct struct {
	Identity auth_identity_struct `json:"identity"`
	Scope    string               `json:"scope"`
}

type scoped_auth_token_request_struct struct {
	Auth scoped_auth_token_struct `json:"auth"`
}

type scoped_auth_password_request_struct struct {
	Auth scoped_auth_password_struct `json:"auth"`
}

type scoped_auth_token_struct struct {
	Nocatalog bool                        `json:"nocatalog"`
	Identity  auth_scoped_identity_struct `json:"identity"`
	Scope     auth_scope_struct           `json:"scope"`
}

type scoped_auth_password_struct struct {
	Nocatalog bool                 `json:"nocatalog"`
	Identity  auth_identity_struct `json:"identity"`
	Scope     auth_scope_struct    `json:"scope"`
}

type auth_scoped_identity_struct struct {
	Methods []string                 `json:"methods"`
	Token   auth_token_method_struct `json:"token"`
}

type auth_identity_struct struct {
	Methods  []string                    `json:"methods"`
	Password auth_password_method_struct `json:"password"`
}

type auth_token_method_struct struct {
	Id string `json:"id"`
}

type auth_password_method_struct struct {
	User auth_user_struct `json:"user"`
}

type auth_user_struct struct {
	Name     string                 `json:"name"`
	Password string                 `json:"password"`
	Domain   auth_userdomain_struct `json:"domain"`
}

type auth_userdomain_struct struct {
	Name string `json:"name"`
}

type auth_scope_struct struct {
	Project auth_project_struct `json:"project"`
}

type auth_project_struct struct {
	Name   string                     `json:"name"`
	Domain auth_project_domain_struct `json:"domain"`
}

type auth_project_domain_struct struct {
	Name string `json:"name"`
}

// Auth Response
type auth_response_struct struct {
	Token auth_token_struct `json:"token"`
}

type auth_token_struct struct {
	Roles      []auth_roles_struct `json:"roles"`
	Expires_at string              `json:"expires_at"`
}

type auth_roles_struct struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

// Projects Response
type project_response_struct struct {
	Projects []project_struct
}

type project_struct struct {
	Name string
}

////////////////////////
// Keystone functions
////////////////////////

// Authentication Section Section
type Auth_data struct {
	Server        string
	Domain        string
	Username      string
	Password      string
	Project       string
	UnscopedToken string
	//response
	Token      string
	Expiration string
	Roles      []auth_roles_struct
}

func AuthenticateScoped(data *Auth_data) error {
	if data.UnscopedToken != "" {
		var auth_post scoped_auth_token_request_struct
		auth_post.Auth.Identity.Methods = []string{"token"}
		auth_post.Auth.Identity.Token.Id = data.UnscopedToken
		auth_post.Auth.Scope.Project.Domain.Name = data.Domain
		auth_post.Auth.Scope.Project.Name = data.Project
		b, _ := json.Marshal(auth_post)
		return authenticate(data, b)
	} else {
		var auth_post scoped_auth_password_request_struct
		auth_post.Auth.Nocatalog = true
		auth_post.Auth.Identity.Methods = []string{"password"}
		auth_post.Auth.Identity.Password.User.Name = data.Username
		auth_post.Auth.Identity.Password.User.Password = data.Password
		auth_post.Auth.Identity.Password.User.Domain.Name = data.Domain
		auth_post.Auth.Scope.Project.Domain.Name = data.Domain
		auth_post.Auth.Scope.Project.Name = data.Project
		b, _ := json.Marshal(auth_post)
		return authenticate(data, b)
	}
}

func AuthenticateUnscoped(data *Auth_data) error {
	var auth_post auth_request_struct
	auth_post.Auth.Scope = "unscoped"
	auth_post.Auth.Identity.Methods = []string{"password"}
	auth_post.Auth.Identity.Password.User.Name = data.Username
	auth_post.Auth.Identity.Password.User.Password = data.Password
	auth_post.Auth.Identity.Password.User.Domain.Name = data.Domain
	b, _ := json.Marshal(auth_post)

	return authenticate(data, b)
}

func authenticate(data *Auth_data, b []byte) error {
	request, err := http.NewRequest("POST", data.Server+"/v3/auth/tokens", bytes.NewBuffer(b))
	if err != nil {
		return err
	}

	client := &http.Client{}
	resp, err := client.Do(request)
	if err != nil {
		return err
	} else if resp.StatusCode != 201 {
		return errors.New("Keystone authentication failed: " + resp.Status)
	}

	decoder := json.NewDecoder(resp.Body)
	var auth_response auth_response_struct
	err = decoder.Decode(&auth_response)
	if err != nil {
		return err
	}

	data.Token = resp.Header.Get("X-Subject-Token")
	data.Expiration = auth_response.Token.Expires_at
	data.Roles = auth_response.Token.Roles

	return nil
}

// Projects Section
type Projects_data struct {
	Token  string
	Server string
	//response
	Projects []string
}

func GetProjects(data *Projects_data) error {
	request, err := http.NewRequest("GET", data.Server+"/v3/auth/projects", nil)
	if err != nil {
		return err
	}
	request.Header.Add("X-Auth-Token", data.Token)

	client := &http.Client{}
	resp, err := client.Do(request)
	if err != nil {
		return err
	} else if resp.StatusCode != 200 {
		return errors.New("Keystone project-list failed: " + resp.Status)
	}

	decoder := json.NewDecoder(resp.Body)
	var project_response project_response_struct
	err = decoder.Decode(&project_response)
	if err != nil {
		return err
	}
	for _, project := range project_response.Projects {
		data.Projects = append(data.Projects, project.Name)
	}
	return nil
}
