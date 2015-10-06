package metrics

var UsageStats = NewRegistry()
var MetricStats = NewRegistry()

var (
	M_Instance_Start = NewComboCounterRef("instance.start")

	M_Page_Status_200 = NewComboCounterRef("page.status.200")
	M_Page_Status_500 = NewComboCounterRef("page.status.500")
	M_Page_Status_404 = NewComboCounterRef("page.status.404")

	M_Api_Status_500 = NewComboCounterRef("api.status.500")
	M_Api_Status_404 = NewComboCounterRef("api.status.404")

	M_Api_User_SignUpStarted   = NewComboCounterRef("api.user.signup_started")
	M_Api_User_SignUpCompleted = NewComboCounterRef("api.user.signup_completed")
	M_Api_User_SignUpInvite    = NewComboCounterRef("api.user.signup_invite")
	M_Api_Dashboard_Get        = NewComboCounterRef("api.dashboard.get")
	M_Api_Dashboard_Post       = NewComboCounterRef("api.dashboard.post")
	M_Api_Admin_User_Create    = NewComboCounterRef("api.admin.user_create")
	M_Api_Login_Post           = NewComboCounterRef("api.login.post")
	M_Api_Login_OAuth          = NewComboCounterRef("api.login.oauth")
	M_Api_Org_Create           = NewComboCounterRef("api.org.create")

	M_Api_Dashboard_Snapshot_Create   = NewComboCounterRef("api.dashboard_snapshot.create")
	M_Api_Dashboard_Snapshot_External = NewComboCounterRef("api.dashboard_snapshot.external")
	M_Api_Dashboard_Snapshot_Get      = NewComboCounterRef("api.dashboard_snapshot.get")

	M_Models_Dashboard_Insert = NewComboCounterRef("models.dashboard.insert")
)
