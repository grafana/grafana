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
  login    = "GRAFANA_LOGIN@grafana.com"
  password = "grafana_login@grafana.com"
  is_admin = false
}

// Creating the grafana-login
resource "grafana_user" "grafana-login-2" {
  email    = "grafana_login_2@grafana.com"
  login    = "grafana_login@grafana.com"
  password = "grafana_login@grafana.com"
  is_admin = false
}

// email conflict
// Creating the grafana-email
resource "grafana_user" "grafana-email" {
  email    = "grafana_email@grafana.com"
  login    = "grafana_email@grafana.com"
  password = "grafana_email@grafana.com"
  is_admin = false
}

// Creating the grafana-email
resource "grafana_user" "grafana-email-2" {
  email    = "GRAFANA_EMAIL@grafana.com"
  login    = "grafana_email_2@grafana.com"
  password = "grafana_email@grafana.com"
  is_admin = false
}

// email and login conflict
// Creating the grafana-user
resource "grafana_user" "grafana-user" {
  email    = "grafana_user@grafana.com"
  login    = "grafana_user@grafana.com"
  password = "grafana_user@grafana.com"
  is_admin = false
}

// Creating the grafana-user
resource "grafana_user" "grafana-user-2" {
  email    = "GRAFANA_USER@grafana.com"
  login    = "GRAFANA_USER@grafana.com"
  password = "grafana_user@grafana.com"
  is_admin = false
}
