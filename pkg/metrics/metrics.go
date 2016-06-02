package metrics

var UsageStats = NewRegistry()
var MetricStats = NewRegistry()

var (
	M_Instance_Start = RegComboCounter("instance_start")

	M_Page_Status_200 = RegComboCounter("page_resp_status", "code", "200")
	M_Page_Status_500 = RegComboCounter("page_resp_status", "code", "500")
	M_Page_Status_404 = RegComboCounter("page_resp_status", "code", "404")

	M_Api_Status_500 = RegComboCounter("api_resp_status", "code", "500")
	M_Api_Status_404 = RegComboCounter("api_resp_status", "code", "404")

	M_Api_User_SignUpStarted   = RegComboCounter("api.user.signup_started")
	M_Api_User_SignUpCompleted = RegComboCounter("api.user.signup_completed")
	M_Api_User_SignUpInvite    = RegComboCounter("api.user.signup_invite")
	M_Api_Dashboard_Get        = RegComboCounter("api.dashboard.get")

	// M_Api_Dashboard_Get_Timer = NewComboTimerRef("api.dashboard_load")

	M_Api_Dashboard_Post    = RegComboCounter("api.dashboard.post")
	M_Api_Admin_User_Create = RegComboCounter("api.admin.user_create")
	M_Api_Login_Post        = RegComboCounter("api.login.post")
	M_Api_Login_OAuth       = RegComboCounter("api.login.oauth")
	M_Api_Org_Create        = RegComboCounter("api.org.create")

	M_Api_Dashboard_Snapshot_Create   = RegComboCounter("api.dashboard_snapshot.create")
	M_Api_Dashboard_Snapshot_External = RegComboCounter("api.dashboard_snapshot.external")
	M_Api_Dashboard_Snapshot_Get      = RegComboCounter("api.dashboard_snapshot.get")

	M_Models_Dashboard_Insert = RegComboCounter("models.dashboard.insert")
)
