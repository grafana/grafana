resource "grafana_contact_point" "contact_point_2b661702215368fe" {
  name = "all-integrations"

  alertmanager {
    disable_resolve_message = true
    url                     = "https://alertmanager-01.com"
    basic_auth_user         = "grafana"
    basic_auth_password     = "[REDACTED]"
  }

  dingding {
    disable_resolve_message = true
    url                     = "[REDACTED]"
    message_type            = "actionCard"
    title                   = "Alerts firing: {{ len .Alerts.Firing }}"
    message                 = "{{ len .Alerts.Firing }} alerts are firing, {{ len .Alerts.Resolved }} are resolved"
  }

  discord {
    disable_resolve_message = true
    url                     = "[REDACTED]"
    title                   = "test-title"
    message                 = "test-message"
    avatar_url              = "http://avatar"
    use_discord_username    = true
  }

  email {
    disable_resolve_message = true
    addresses               = ["test@grafana.com"]
    single_email            = true
    message                 = "test-message"
    subject                 = "test-subject"
  }

  googlechat {
    disable_resolve_message = true
    url                     = "[REDACTED]"
    title                   = "test-title"
    message                 = "test-message"
  }

  jira {
    disable_resolve_message = true
    api_url                 = "http://localhost"
    project                 = "Test Project"
    issue_type              = "Test Issue Type"
    summary                 = "Test Summary"
    description             = "Test Description"
    labels                  = ["Test Label", "Test Label 2"]
    priority                = "Test Priority"
    reopen_transition       = "Test Reopen Transition"
    resolve_transition      = "Test Resolve Transition"
    wont_fix_resolution     = "Test Won't Fix Resolution"
    reopen_duration         = "1m"
    dedup_key_field         = "10000"
    fields                  = "{\"test-field\":\"test-value\"}"
    user                    = "[REDACTED]"
    password                = "[REDACTED]"
  }

  kafka {
    disable_resolve_message = true
    rest_proxy_url          = "http://localhost/"
    topic                   = "test-topic"
    description             = "test-description"
    details                 = "test-details"
    username                = "test-user"
    password                = "[REDACTED]"
    api_version             = "v2"
    cluster_id              = "12345"
  }

  line {
    disable_resolve_message = true
    token                   = "[REDACTED]"
    title                   = "test-title"
    description             = "test-description"
  }

  mqtt {
    disable_resolve_message = true
    broker_url              = "tcp://localhost:1883"
    client_id               = "grafana-test-client-id"
    topic                   = "grafana/alerts"
    message_format          = "json"
    username                = "test-username"
    password                = "[REDACTED]"
    qos                     = 0
    retain                  = false

    tls_config {
      insecure_skip_verify = false
      ca_certificate       = "[REDACTED]"
      client_certificate   = "[REDACTED]"
      client_key           = "[REDACTED]"
    }
  }

  opsgenie {
    disable_resolve_message = true
    api_key                 = "[REDACTED]"
    url                     = "http://localhost"
    message                 = "test-message"
    description             = "test-description"
    auto_close              = false
    override_priority       = false
    send_tags_as            = "both"

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
    disable_resolve_message = true
    integration_key         = "[REDACTED]"
    severity                = "test-severity"
    class                   = "test-class"
    component               = "test-component"
    group                   = "test-group"
    summary                 = "test-summary"
    source                  = "test-source"
    client                  = "test-client"
    client_url              = "http://localhost/test-client-url"
    url                     = "http://localhost/test-api-url"
  }

  oncall {
    disable_resolve_message = true
    url                     = "http://localhost"
    http_method             = "PUT"
    max_alerts              = 2
    authorization_scheme    = "basic"
    basic_auth_user         = "test-user"
    basic_auth_password     = "[REDACTED]"
    title                   = "test-title"
    message                 = "test-message"
  }

  pushover {
    disable_resolve_message = true
    user_key                = "[REDACTED]"
    api_token               = "[REDACTED]"
    priority                = 1
    ok_priority             = 2
    retry                   = 555
    expire                  = 333
    device                  = "test-device"
    sound                   = "test-sound"
    ok_sound                = "test-ok-sound"
    title                   = "test-title"
    message                 = "test-message"
    upload_image            = false
  }

  sensugo {
    disable_resolve_message = true
    url                     = "http://localhost"
    api_key                 = "[REDACTED]"
    entity                  = "test-entity"
    check                   = "test-check"
    namespace               = "test-namespace"
    handler                 = "test-handler"
    message                 = "test-message"
  }

  slack {
    disable_resolve_message = true
    endpoint_url            = "http://localhost/endpoint_url"
    url                     = "[REDACTED]"
    token                   = "[REDACTED]"
    recipient               = "test-recipient"
    text                    = "test-text"
    title                   = "test-title"
    username                = "test-username"
    icon_emoji              = "test-icon"
    icon_url                = "http://localhost/icon_url"
    mention_channel         = "channel"
    mention_users           = "test-mentionUsers"
    mention_groups          = "test-mentionGroups"
    color                   = "test-color"
  }

  sns {
    disable_resolve_message = true
    api_url                 = "https://sns.us-east-1.amazonaws.com"

    sigv4 {
      region     = "us-east-1"
      access_key = "[REDACTED]"
      secret_key = "[REDACTED]"
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
    disable_resolve_message = true
    url                     = "http://localhost"
    message                 = "test-message"
    title                   = "test-title"
    section_title           = "test-second-title"
  }

  telegram {
    disable_resolve_message  = true
    token                    = "[REDACTED]"
    chat_id                  = "12345678"
    message_thread_id        = "13579"
    message                  = "test-message"
    parse_mode               = "html"
    disable_web_page_preview = true
    protect_content          = true
    disable_notifications    = true
  }

  threema {
    disable_resolve_message = true
    gateway_id              = "*1234567"
    recipient_id            = "*1234567"
    api_secret              = "[REDACTED]"
    title                   = "test-title"
    description             = "test-description"
  }

  victorops {
    disable_resolve_message = true
    url                     = "[REDACTED]"
    message_type            = "test-messagetype"
    title                   = "test-title"
    description             = "test-description"
  }

  webhook {
    disable_resolve_message = true
    url                     = "http://localhost"
    http_method             = "PUT"
    max_alerts              = 2
    authorization_scheme    = "basic"
    basic_auth_user         = "test-user"
    basic_auth_password     = "[REDACTED]"
    title                   = "test-title"
    message                 = "test-message"

    tls_config {
      insecure_skip_verify = false
      ca_certificate       = "[REDACTED]"
      client_certificate   = "[REDACTED]"
      client_key           = "[REDACTED]"
    }

    hmac_config {
      secret           = "[REDACTED]"
      header           = "X-Grafana-Alerting-Signature"
      timestamp_header = "X-Grafana-Alerting-Timestamp"
    }

    http_config {

      oauth2 {
        client_id     = "test-client-id"
        client_secret = "[REDACTED]"
        token_url     = "https://localhost/auth/token"
        scopes        = ["scope1", "scope2"]
        endpoint_params = {
          param1 = "value1"
          param2 = "value2"
        }

        tls_config {
          insecure_skip_verify = false
          ca_certificate       = "[REDACTED]"
          client_certificate   = "[REDACTED]"
          client_key           = "[REDACTED]"
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
    disable_resolve_message = true
    url                     = "[REDACTED]"
    secret                  = "[REDACTED]"
    agent_id                = "test-agent_id"
    corp_id                 = "test-corp_id"
    message                 = "test-message"
    title                   = "test-title"
    msg_type                = "markdown"
    to_user                 = "test-touser"
  }

  webex {
    disable_resolve_message = true
    token                   = "[REDACTED]"
    api_url                 = "http://localhost"
    message                 = "test-message"
    room_id                 = "test-room-id"
  }
}
