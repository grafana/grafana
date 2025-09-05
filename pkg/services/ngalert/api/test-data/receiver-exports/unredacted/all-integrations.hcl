resource "grafana_contact_point" "contact_point_2b661702215368fe" {
  name = "all-integrations"

  alertmanager {
    url                 = "https://alertmanager-01.com"
    basic_auth_user     = "grafana"
    basic_auth_password = "admin"
  }

  dingding {
    url          = "http://localhost"
    message_type = "actionCard"
    title        = "Alerts firing: {{ len .Alerts.Firing }}"
    message      = "{{ len .Alerts.Firing }} alerts are firing, {{ len .Alerts.Resolved }} are resolved"
  }

  discord {
    url                  = "http://localhost"
    title                = "test-title"
    message              = "test-message"
    avatar_url           = "http://avatar"
    use_discord_username = true
  }

  email {
    addresses    = ["test@grafana.com"]
    single_email = true
    message      = "test-message"
    subject      = "test-subject"
  }

  googlechat {
    url     = "http://localhost"
    title   = "test-title"
    message = "test-message"
  }

  jira {
    api_url             = "http://localhost"
    project             = "Test Project"
    issue_type          = "Test Issue Type"
    summary             = "Test Summary"
    description         = "Test Description"
    labels              = ["Test Label", "Test Label 2"]
    priority            = "Test Priority"
    reopen_transition   = "Test Reopen Transition"
    resolve_transition  = "Test Resolve Transition"
    wont_fix_resolution = "Test Won't Fix Resolution"
    reopen_duration     = "1m"
    dedup_key_field     = "10000"
    fields              = "{\"test-field\":\"test-value\"}"
    user                = "user"
    password            = "password"
  }

  kafka {
    rest_proxy_url = "http://localhost/"
    topic          = "test-topic"
    description    = "test-description"
    details        = "test-details"
    username       = "test-user"
    password       = "password"
    api_version    = "v2"
    cluster_id     = "12345"
  }

  line {
    token       = "test"
    title       = "test-title"
    description = "test-description"
  }

  mqtt {
    broker_url     = "tcp://localhost:1883"
    client_id      = "grafana-test-client-id"
    topic          = "grafana/alerts"
    message_format = "json"
    username       = "test-username"
    password       = "test-password"
    qos            = 0
    retain         = false

    tls_config {
      insecure_skip_verify = false
      ca_certificate       = "test-tls-ca-certificate"
      client_certificate   = "test-tls-client-certificate"
      client_key           = "test-tls-client-key"
    }
  }

  opsgenie {
    api_key           = "test-api-key"
    url               = "http://localhost"
    message           = "test-message"
    description       = "test-description"
    auto_close        = false
    override_priority = false
    send_tags_as      = "both"

    responders {
      id   = "test-id"
      type = "team"
    }
    responders {
      username = "test-user"
      type     = "user"
    }
    responders {
      name = "test-schedule"
      type = "schedule"
    }
  }

  pagerduty {
    integration_key = "test-api-key"
    severity        = "test-severity"
    class           = "test-class"
    component       = "test-component"
    group           = "test-group"
    summary         = "test-summary"
    source          = "test-source"
    client          = "test-client"
    client_url      = "http://localhost/test-client-url"
    url             = "http://localhost/test-api-url"
  }

  oncall {
    url                  = "http://localhost"
    http_method          = "PUT"
    max_alerts           = 2
    authorization_scheme = "basic"
    basic_auth_user      = "test-user"
    basic_auth_password  = "test-pass"
    title                = "test-title"
    message              = "test-message"
  }

  pushover {
    user_key     = "test-user-key"
    api_token    = "test-api-token"
    priority     = 1
    ok_priority  = 2
    retry        = 555
    expire       = 333
    device       = "test-device"
    sound        = "test-sound"
    ok_sound     = "test-ok-sound"
    title        = "test-title"
    message      = "test-message"
    upload_image = false
  }

  sensugo {
    url       = "http://localhost"
    api_key   = "test-api-key"
    entity    = "test-entity"
    check     = "test-check"
    namespace = "test-namespace"
    handler   = "test-handler"
    message   = "test-message"
  }

  slack {
    endpoint_url    = "http://localhost/endpoint_url"
    url             = "http://localhost/url"
    token           = "test-token"
    recipient       = "test-recipient"
    text            = "test-text"
    title           = "test-title"
    username        = "test-username"
    icon_emoji      = "test-icon"
    icon_url        = "http://localhost/icon_url"
    mention_channel = "channel"
    mention_users   = "test-mentionUsers"
    mention_groups  = "test-mentionGroups"
    color           = "test-color"
  }

  sns {
    api_url = "https://sns.us-east-1.amazonaws.com"

    sigv4 {
      region     = "us-east-1"
      access_key = "access-key"
      secret_key = "secret-key"
      profile    = "default"
      role_arn   = "arn:aws:iam:us-east-1:0123456789:role/my-role"
    }

    topic_arn    = "arn:aws:sns:us-east-1:0123456789:SNSTopicName"
    phone_number = "123-456-7890"
    target_arn   = "arn:aws:sns:us-east-1:0123456789:SNSTopicName"
    subject      = "subject"
    message      = "message"
    attributes = {
      attr1 = "val1"
    }
  }

  teams {
    url           = "http://localhost"
    message       = "test-message"
    title         = "test-title"
    section_title = "test-second-title"
  }

  telegram {
    token                    = "test-token"
    chat_id                  = "12345678"
    message_thread_id        = "13579"
    message                  = "test-message"
    parse_mode               = "html"
    disable_web_page_preview = true
    protect_content          = true
    disable_notifications    = true
  }

  threema {
    gateway_id   = "*1234567"
    recipient_id = "*1234567"
    api_secret   = "test-secret"
    title        = "test-title"
    description  = "test-description"
  }

  victorops {
    url          = "http://localhost"
    message_type = "test-messagetype"
    title        = "test-title"
    description  = "test-description"
  }

  webhook {
    url                  = "http://localhost"
    http_method          = "PUT"
    max_alerts           = 2
    authorization_scheme = "basic"
    basic_auth_user      = "test-user"
    basic_auth_password  = "test-pass"
    title                = "test-title"
    message              = "test-message"

    tls_config {
      insecure_skip_verify = false
      ca_certificate       = "-----BEGIN CERTIFICATE-----\nMIGrMF+gAwIBAgIBATAFBgMrZXAwADAeFw0yNDExMTYxMDI4MzNaFw0yNTExMTYx\nMDI4MzNaMAAwKjAFBgMrZXADIQCf30GvRnHbs9gukA3DLXDK6W5JVgYw6mERU/60\n2M8+rjAFBgMrZXADQQCGmeaRp/AcjeqmJrF5Yh4d7aqsMSqVZvfGNDc0ppXyUgS3\nWMQ1+3T+/pkhU612HR0vFd3vyFhmB4yqFoNV8RML\n-----END CERTIFICATE-----"
      client_certificate   = "-----BEGIN CERTIFICATE-----\nMIIBhTCCASugAwIBAgIQIRi6zePL6mKjOipn+dNuaTAKBggqhkjOPQQDAjASMRAw\nDgYDVQQKEwdBY21lIENvMB4XDTE3MTAyMDE5NDMwNloXDTE4MTAyMDE5NDMwNlow\nEjEQMA4GA1UEChMHQWNtZSBDbzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABD0d\n7VNhbWvZLWPuj/RtHFjvtJBEwOkhbN/BnnE8rnZR8+sbwnc/KhCk3FhnpHZnQz7B\n5aETbbIgmuvewdjvSBSjYzBhMA4GA1UdDwEB/wQEAwICpDATBgNVHSUEDDAKBggr\nBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MCkGA1UdEQQiMCCCDmxvY2FsaG9zdDo1\nNDUzgg4xMjcuMC4wLjE6NTQ1MzAKBggqhkjOPQQDAgNIADBFAiEA2zpJEPQyz6/l\nWf86aX6PepsntZv2GYlA5UpabfT2EZICICpJ5h/iI+i341gBmLiAFQOyTDT+/wQc\n6MF9+Yw1Yy0t\n-----END CERTIFICATE-----"
      client_key           = "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEIIrYSSNQFaA2Hwf1duRSxKtLYX5CB04fSeQ6tF1aY/PuoAoGCCqGSM49\nAwEHoUQDQgAEPR3tU2Fta9ktY+6P9G0cWO+0kETA6SFs38GecTyudlHz6xvCdz8q\nEKTcWGekdmdDPsHloRNtsiCa697B2O9IFA==\n-----END EC PRIVATE KEY-----"
    }

    hmac_config {
      secret           = "test-hmac-secret"
      header           = "X-Grafana-Alerting-Signature"
      timestamp_header = "X-Grafana-Alerting-Timestamp"
    }

    http_config {

      oauth2 {
        client_id     = "test-client-id"
        client_secret = "test-client-secret"
        token_url     = "https://localhost/auth/token"
        scopes        = ["scope1", "scope2"]
        endpoint_params = {
          param1 = "value1"
          param2 = "value2"
        }

        tls_config {
          insecure_skip_verify = false
          ca_certificate       = "-----BEGIN CERTIFICATE-----\nMIGrMF+gAwIBAgIBATAFBgMrZXAwADAeFw0yNDExMTYxMDI4MzNaFw0yNTExMTYx\nMDI4MzNaMAAwKjAFBgMrZXADIQCf30GvRnHbs9gukA3DLXDK6W5JVgYw6mERU/60\n2M8+rjAFBgMrZXADQQCGmeaRp/AcjeqmJrF5Yh4d7aqsMSqVZvfGNDc0ppXyUgS3\nWMQ1+3T+/pkhU612HR0vFd3vyFhmB4yqFoNV8RML\n-----END CERTIFICATE-----"
          client_certificate   = "-----BEGIN CERTIFICATE-----\nMIIBhTCCASugAwIBAgIQIRi6zePL6mKjOipn+dNuaTAKBggqhkjOPQQDAjASMRAw\nDgYDVQQKEwdBY21lIENvMB4XDTE3MTAyMDE5NDMwNloXDTE4MTAyMDE5NDMwNlow\nEjEQMA4GA1UEChMHQWNtZSBDbzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABD0d\n7VNhbWvZLWPuj/RtHFjvtJBEwOkhbN/BnnE8rnZR8+sbwnc/KhCk3FhnpHZnQz7B\n5aETbbIgmuvewdjvSBSjYzBhMA4GA1UdDwEB/wQEAwICpDATBgNVHSUEDDAKBggr\nBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MCkGA1UdEQQiMCCCDmxvY2FsaG9zdDo1\nNDUzgg4xMjcuMC4wLjE6NTQ1MzAKBggqhkjOPQQDAgNIADBFAiEA2zpJEPQyz6/l\nWf86aX6PepsntZv2GYlA5UpabfT2EZICICpJ5h/iI+i341gBmLiAFQOyTDT+/wQc\n6MF9+Yw1Yy0t\n-----END CERTIFICATE-----"
          client_key           = "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEIIrYSSNQFaA2Hwf1duRSxKtLYX5CB04fSeQ6tF1aY/PuoAoGCCqGSM49\nAwEHoUQDQgAEPR3tU2Fta9ktY+6P9G0cWO+0kETA6SFs38GecTyudlHz6xvCdz8q\nEKTcWGekdmdDPsHloRNtsiCa697B2O9IFA==\n-----END EC PRIVATE KEY-----"
        }

        proxy_config {
          proxy_url              = "http://localproxy:8080"
          no_proxy               = "localhost"
          proxy_from_environment = false
          proxy_connect_header = {
            X-Proxy-Header = "proxy-value"
          }
        }
      }
    }
  }

  wecom {
    url      = "test-url"
    secret   = "test-secret"
    agent_id = "test-agent_id"
    corp_id  = "test-corp_id"
    message  = "test-message"
    title    = "test-title"
    msg_type = "markdown"
    to_user  = "test-touser"
  }

  webex {
    token   = "12345"
    api_url = "http://localhost"
    message = "test-message"
    room_id = "test-room-id"
  }
}
