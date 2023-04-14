terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
    }
  }
}

// Configure the Grafana Provider
provider "grafana" {
  url  = "http://localhost:3000/"
  auth = "admin:admin"
}

// login conflict
// Creating the grafana-login
resource "grafana_user" "grafana-login" {
  email    = "grafana_login@grafana.com"
  login    = "GRAFANA_LOGIN"
  password = "grafana_login@grafana.com"
  is_admin = false
}

// Creating the grafana-login
resource "grafana_user" "grafana-login-2" {
  email    = "grafana_login_2@grafana.com"
  login    = "grafana_login"
  password = "grafana_login@grafana.com"
  is_admin = false
}

// email conflict
// Creating the grafana-email
resource "grafana_user" "grafana-email" {
  email    = "grafana_email@grafana.com"
  login    = "user_login_a"
  password = "grafana_email@grafana.com"
  is_admin = false
}

// Creating the grafana-email
resource "grafana_user" "grafana-email-2" {
  email    = "GRAFANA_EMAIL@grafana.com"
  login    = "user_login_b"
  password = "grafana_email@grafana.com"
  is_admin = false
}

// email and login conflict
// Creating the grafana-user
resource "grafana_user" "grafana-user" {
  email    = "grafana_user@grafana.com"
  login    = "grafana_user"
  password = "grafana_user@grafana.com"
  is_admin = false
}

// Creating the grafana-user
resource "grafana_user" "grafana-user-2" {
  email    = "GRAFANA_USER@grafana.com"
  login    = "GRAFANA_USER"
  password = "grafana_user@grafana.com"
  is_admin = false
}
