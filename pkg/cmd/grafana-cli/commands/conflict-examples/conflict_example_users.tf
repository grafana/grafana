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
  email    = "grafana_email_1@grafana.com"
  login    = "GRAFANA_LOGIN"
  password = "grafana_login@grafana.com"
  is_admin = false
}

// Creating the grafana-login
resource "grafana_user" "grafana-login-2" {
  email    = "grafan_email_2@grafana.com"
  login    = "grafana_login"
  password = "grafana_login@grafana.com"
  is_admin = false
}
