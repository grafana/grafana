/**
 * $Id: mxGCP2.js,v 1.0 2018/08/21 13:05:39 mate Exp $
 * Copyright (c) 2006-2018, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//double rect
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGCP2DoubleRect(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeGCP2DoubleRect, mxShape);

mxShapeGCP2DoubleRect.prototype.cst = {
		SHAPE_DOUBLE_RECT : 'mxgraph.gcp2.doubleRect'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGCP2DoubleRect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var dx = 8;
	var dy = 8;
	
	w = w - dx;
	h = h - dy;
	
	c.translate(x, y);
	c.begin();
	c.roundrect(dx, dy, w , h, 1, 1);
	c.fillAndStroke();
	c.roundrect(0, 0, w, h, 1, 1);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeGCP2DoubleRect.prototype.cst.SHAPE_DOUBLE_RECT, mxShapeGCP2DoubleRect);
mxShapeGCP2DoubleRect.prototype.constraints = mxRectangleShape.prototype.constraints;

//**********************************************************************************************************************************************************
//hexagonal icon
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGCP2HexIcon(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeGCP2HexIcon, mxShape);

mxShapeGCP2HexIcon.prototype.cst = {
		HEX_ICON : 'mxgraph.gcp2.hexIcon'
};

mxShapeGCP2HexIcon.prototype.customProperties = [
	{name: 'instNum', dispName: 'Number of instances', type: 'int', min: 0, defVal: 0},
	{name: 'prType', dispName: 'Instance Type', defVal: 'standard', type: 'enum', 
		enumList: [{val: 'standard', dispName: 'Standard'}, 
				   {val: 'dynamic', dispName: 'Dynamic'}, 
				   {val: 'multiple', dispName: 'Multiple'}, 
				   {val: 'shared', dispName: 'Shared'}, 
				   {val: 'replica', dispName: 'Replica'}, 
				   {val: 'dynamic2', dispName: 'Dynamic 2'}, 
				   {val: 'dynamic3', dispName: 'Dynamic 3'}, 
				   {val: 'highmem', dispName: 'High-Mem'}, 
				   {val: 'highcomp', dispName: 'High-Comp'},
				   {val: 'backend', dispName: 'Backend'},
				   {val: 'input', dispName: 'Input'}]},
	{name: 'prIcon', dispName: 'Instance Icon', defVal: 'compute_engine', type: 'enum', 
			enumList: [{val: 'compute_engine', dispName: 'Compute Engine'}, 
				       {val: 'gpu', dispName: 'GPU'},
				       {val: 'app_engine', dispName: 'App Engine'},
				       {val: 'cloud_functions', dispName: 'Cloud Functions'},
				       {val: 'container_engine', dispName: 'Kubernetes Engine'},
				       {val: 'container_optimized_os', dispName: 'Container-Optimized OS'},
				       {val: 'api_analytics', dispName: 'API Analytics'},
				       {val: 'apigee_sense', dispName: 'Apigee Sense'},
				       {val: 'api_monetization', dispName: 'API Monetization'},
				       {val: 'cloud_endpoints', dispName: 'Cloud Endpoints'},
				       {val: 'apigee_api_platform', dispName: 'Apigee API Platform'},
				       {val: 'developer_portal', dispName: 'Developer Portal'},
				       {val: 'cloud_iam', dispName: 'Cloud IAM'},
				       {val: 'beyondcorp', dispName: 'BeyondCorp'},
				       {val: 'cloud_iam', dispName: 'Cloud Resource Manager'},
				       {val: 'data_loss_prevention_api', dispName: 'Data Loss Prevention API'},
				       {val: 'cloud_security_scanner', dispName: 'Cloud Security Scanner'},
				       {val: 'key_management_service', dispName: 'Key Management Service'},
				       {val: 'identity_aware_proxy', dispName: 'Identity-Aware Proxy'},
				       {val: 'security_key_enforcement', dispName: 'Security Key Enforcement'},
				       {val: 'bigquery', dispName: 'BigQuery'},
				       {val: 'cloud_datalab', dispName: 'Cloud Datalab'},
				       {val: 'cloud_dataflow', dispName: 'Cloud Dataflow'},
				       {val: 'cloud_pubsub', dispName: 'Cloud Pub/Sub'},
				       {val: 'cloud_dataproc', dispName: 'Cloud Dataproc'},
				       {val: 'genomics', dispName: 'Genomics'},
				       {val: 'cloud_dataprep', dispName: 'Cloud Dataprep'},
				       {val: 'data_studio', dispName: 'Data Studio'},
				       {val: 'transfer_appliance', dispName: 'Transfer Appliance'},
				       {val: 'cloud_machine_learning', dispName: 'Cloud Machine Learning'},
				       {val: 'cloud_natural_language_api', dispName: 'Cloud Natural Language API'},
				       {val: 'cloud_vision_api', dispName: 'Vision API'},
				       {val: 'cloud_translation_api', dispName: 'Translation API'},
				       {val: 'cloud_speech_api', dispName: 'Speech API'},
				       {val: 'cloud_jobs_api', dispName: 'Jobs API'},
				       {val: 'cloud_video_intelligence_api', dispName: 'Cloud Video Intelligence API'},
				       {val: 'advanced_solutions_lab', dispName: 'Advanced Solutions Lab'},
				       {val: 'cloud_iot_core', dispName: 'Cloud IoT Core'},
				       {val: 'cloud_storage', dispName: 'Cloud Storage'},
				       {val: 'cloud_sql', dispName: 'Cloud SQL'},
				       {val: 'cloud_bigtable', dispName: 'Cloud Bigtable'},
				       {val: 'cloud_spanner', dispName: 'Cloud Spanner'},
				       {val: 'cloud_datastore', dispName: 'Cloud Datastore'},
				       {val: 'persistent_disk', dispName: 'Persistent Disk'},
				       {val: 'cloud_memorystore', dispName: 'Cloud Memorystore'},
				       {val: 'cloud_filestore', dispName: 'Cloud Filestore'},
				       {val: 'stackdriver', dispName: 'Stackdriver'},
				       {val: 'cloud_deployment_manager', dispName: 'Monitoring'},
				       {val: 'cloud_deployment_manager', dispName: 'Deployment Manager'},
				       {val: 'logging', dispName: 'Logging'},
				       {val: 'placeholder', dispName: 'Cloud Console'},
				       {val: 'error_reporting', dispName: 'Error Reporting'},
				       {val: 'placeholder', dispName: 'Cloud Shell'},
				       {val: 'trace', dispName: 'Trace'},
				       {val: 'placeholder', dispName: 'Cloud Mobile App'},
				       {val: 'profiler', dispName: 'Profiler'},
				       {val: 'placeholder', dispName: 'Billing API'},
				       {val: 'cloud_apis', dispName: 'Cloud APIs'},
				       {val: 'virtual_private_cloud', dispName: 'Virtual Private Cloud'},
				       {val: 'dedicated_interconnect', dispName: 'Dedicated Interconnect'},
				       {val: 'cloud_load_balancing', dispName: 'Cloud Load Balancing'},
				       {val: 'cloud_dns', dispName: 'Cloud DNS'},
				       {val: 'cloud_cdn', dispName: 'Cloud CDN'},
				       {val: 'cloud_network', dispName: 'Cloud Network'},
				       {val: 'cloud_external_ip_addresses', dispName: 'Cloud External IP Addresses'},
				       {val: 'cloud_routes', dispName: 'Cloud Routes'},
				       {val: 'cloud_firewall_rules', dispName: 'Cloud Firewall Rules'},
				       {val: 'cloud_vpn', dispName: 'Cloud VPN'},
				       {val: 'cloud_router', dispName: 'Cloud Router'},
				       {val: 'cloud_armor', dispName: 'Cloud Armor'},
				       {val: 'standard_network_tier', dispName: 'Standard Network Tier'},
				       {val: 'premium_network_tier', dispName: 'Premium Network Tier'},
				       {val: 'partner_interconnect', dispName: 'Partner Interconnect'},
				       {val: 'placeholder', dispName: 'Cloud SDK'},
				       {val: 'container_builder', dispName: 'Cloud Build'},
				       {val: 'cloud_tools_for_powershell', dispName: 'Cloud Tools for Visual Studio'},
				       {val: 'placeholder', dispName: 'Cloud Source Repositories'},
				       {val: 'placeholder', dispName: 'Maven App Engine Plugin'},
				       {val: 'placeholder', dispName: 'Cloud Tools for Eclipse'},
				       {val: 'placeholder', dispName: 'Cloud Tools for IntelliJ'},
				       {val: 'placeholder', dispName: 'Cloud Test Lab'},
				       {val: 'cloud_tools_for_powershell', dispName: 'Cloud Tools for PowerShell'},
				       {val: 'cloud_tools_for_powershell', dispName: 'IDE Plugins'},
				       {val: 'container_registry', dispName: 'Container Registry'},
				       {val: 'cloud_iot_edge', dispName: 'Cloud IoT Edge'},
				       {val: 'cloud_firestore', dispName: 'Cloud Firestore'},
				       {val: 'cloud_run', dispName: 'Cloud Run'},
				       {val: 'gke_on_prem', dispName: 'GKE-on-Prem'},
				       {val: 'cloud_data_catalog', dispName: 'Cloud Data Catalog'},
				       {val: 'cloud_data_fusion', dispName: 'Cloud Data Fusion'},
				       {val: 'ai_hub', dispName: 'AI Hub'},
				       {val: 'automl_video_intelligence', dispName: 'AutoML Video Intelligence'},
				       {val: 'automl_natural_language', dispName: 'AutoML Natural Language'},
				       {val: 'automl_tables', dispName: 'AutoML Tables'},
				       {val: 'automl_translation', dispName: 'AutoML Translation'},
				       {val: 'automl_vision', dispName: 'AutoML Vision'},
				       {val: 'recommendations_ai', dispName: 'Recommendations AI'},
				       {val: 'cloud_inference_api', dispName: 'Cloud Inference API'},
				       {val: 'cloud_service_mesh', dispName: 'Cloud Service Mesh'},
				       {val: 'cloud_nat', dispName: 'Cloud NAT'},
				       {val: 'traffic_director', dispName: 'Traffic Director'},
				       {val: 'cloud_test_lab', dispName: 'Cloud Test Lab'},
				       {val: 'cloud_code', dispName: 'Cloud Code'},
				       {val: 'cloud_tasks', dispName: 'Cloud Tasks'},
				       {val: 'placeholder', dispName: 'Gradle App Engine Plugin'}]}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGCP2HexIcon.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var prIcon = mxUtils.getValue(this.state.style, 'prIcon', 'compute_engine');
	var prType = mxUtils.getValue(this.state.style, 'prType', '');
	var instNum = parseInt(mxUtils.getValue(this.state.style, 'instNum', 0));
	var fillColor = mxUtils.getValue(this.state.style, 'fillColor', '#ffffff');
	var opacity = mxUtils.getValue(this.state.style, 'opacity', '100');
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', 'none');
	var strokeWidth = mxUtils.getValue(this.state.style, 'strokeWidth', 1);
	var iconSize = Math.min(w, h);
	
	switch(prType)
	{
		case 'dynamic':
			var bgSt1 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_blank_2');
			c.setAlpha(opacity * 0.5 / 100);
			c.setStrokeColor('none');
			bgSt1.drawShape(c, this, w * 0.21, h * 0.12, w * 0.58, h * 0.76);
			break;
		case 'multiple':
			var bgSt1 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_blank_2');
			c.setAlpha(opacity * 0.5 / 100);
			c.setStrokeColor('none');
			bgSt1.drawShape(c, this, w * 0.21, h * 0.12, w * 0.58, h * 0.76);
			var bgSt2 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_blank_3');
			c.setAlpha(opacity * 0.7 / 100);
			c.setStrokeColor('none');
			bgSt2.drawShape(c, this, w * 0.17, h * 0.13, w * 0.66, h * 0.74);
			break;
		case 'shared':
			var bgSt1 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_blank_1');
			this.style[mxConstants.STYLE_STROKEWIDTH] = iconSize * 0.038;
			c.setAlpha(opacity * 0.4 / 100);
			c.setStrokeColor(fillColor);
			c.setFillColor('none');
			bgSt1.drawShape(c, this, w * 0.02, h * 0, w * 0.96, h);
			var bgSt2 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_blank_2');
			c.setAlpha(opacity * 0.7 / 100);
			bgSt2.drawShape(c, this, w * 0.14, h * 0.01, w * 0.72, h * 0.98);
			c.setAlpha(opacity / 100);
			c.setFillColor('#ffffff');
			bgSt1.drawShape(c, this, w * 0.13, h * 0.12, w * 0.74, h * 0.76);
			this.style[mxConstants.STYLE_STROKEWIDTH] = strokeWidth;
			break;
		case 'replica':
			var bgSt1 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_blank_1');
			this.style[mxConstants.STYLE_STROKEWIDTH] = iconSize * 0.038;
			c.setAlpha(opacity * 0.4 / 100);
			c.setStrokeColor(fillColor);
			c.setFillColor('none');
			bgSt1.drawShape(c, this, w * 0.02, h * 0, w * 0.96, h);
			c.setAlpha(opacity * 0.7 / 100);
			bgSt1.drawShape(c, this, w * 0.075, h * 0.06, w * 0.85, h * 0.88);
			c.setAlpha(opacity / 100);
			c.setFillColor('#ffffff');
			bgSt1.drawShape(c, this, w * 0.13, h * 0.12, w * 0.74, h * 0.76);
			this.style[mxConstants.STYLE_STROKEWIDTH] = strokeWidth;
			break;
		case 'dynamic2':
			var bgSt1 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_blank_2');
			c.setAlpha(opacity * 0.5 / 100);
			c.setStrokeColor('none');
			bgSt1.drawShape(c, this, w * 0.14, h * 0.01, w * 0.72, h * 0.98);
			var bgSt2 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_blank_1');
			this.style[mxConstants.STYLE_STROKEWIDTH] = iconSize * 0.01;
			c.setStrokeColor(fillColor);
			c.setAlpha(opacity / 100);
			c.setFillColor('#ffffff');
			bgSt2.drawShape(c, this, w * 0.13, h * 0.12, w * 0.74, h * 0.76);
			this.style[mxConstants.STYLE_STROKEWIDTH] = strokeWidth;
			break;
		case 'dynamic3':
			var bgSt1 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_blank_2');
			c.setStrokeColor('none');
			bgSt1.drawShape(c, this, w * 0.14, h * 0.01, w * 0.72, h * 0.98);
			var bgSt2 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_blank_1');
			this.style[mxConstants.STYLE_STROKEWIDTH] = iconSize * 0.01;
			c.setStrokeColor(fillColor);
			c.setAlpha(opacity / 100);
			c.setFillColor('#ffffff');
			bgSt2.drawShape(c, this, w * 0.13, h * 0.12, w * 0.74, h * 0.76);
			this.style[mxConstants.STYLE_STROKEWIDTH] = strokeWidth;
			break;
		case 'highmem':
			var bgSt1 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_highmem');
			c.setAlpha(opacity * 0.5 / 100);
			c.setStrokeColor('none');
			bgSt1.drawShape(c, this, 0, h * 0.56, w, h * 0.28);
			break;
		case 'highcomp':
			var bgSt1 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_highcomp');
			c.setAlpha(opacity * 0.5 / 100);
			c.setStrokeColor('none');
			bgSt1.drawShape(c, this, 0, h * 0.16, w, h * 0.28);
			break;
		case 'backend':
			var bgSt1 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_blank_1');
			c.setFillColor('#FCC64D');
			bgSt1.drawShape(c, this, w * 0.12, h * 0.11, w * 0.76, h * 0.78);
			break;
		case 'input':
			var bgSt1 = mxStencilRegistry.getStencil('mxgraph.gcp2.outline_blank_1');
			c.setFillColor('#A5DA40');
			bgSt1.drawShape(c, this, w * 0.12, h * 0.11, w * 0.76, h * 0.78);
			break;
		case 'standard':
		default:
			break;
	}
	
	c.setAlpha(opacity / 100);
	var stencil = mxStencilRegistry.getStencil('mxgraph.gcp2.' + prIcon);
	
	if (stencil != null)
	{
		c.setFillColor(fillColor);
		c.setStrokeColor('none');
		stencil.drawShape(c, this, w * 0.17, h * 0.16, w * 0.66, h * 0.68);
	}

	if (instNum > 0)
	{
		c.setFillColor('#ffffff');
		c.setStrokeColor('#ffffff');
		c.setStrokeWidth(iconSize * 0.038);
		c.ellipse(w * 0.2, 0, w * 0.18, h * 0.22);
		c.fillAndStroke();

		c.setAlpha(opacity * 0.5 / 100);
		c.setStrokeColor(fillColor);
		c.ellipse(w * 0.2, 0, w * 0.18, h * 0.22);
		c.stroke();

		c.setAlpha(opacity / 100);
		c.setFontColor('#4E6B89');
		c.setFontStyle(1);
		c.setFontSize(Math.min(w, h) * 0.1);
		
		c.text(w * 0.29, h * 0.11 + 1, 0, 0, instNum.toString(), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
};

mxCellRenderer.registerShape(mxShapeGCP2HexIcon.prototype.cst.HEX_ICON, mxShapeGCP2HexIcon);

mxShapeGCP2HexIcon.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0.825, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.175, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0.16), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0.84), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.66, 0.17), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.66, 0.83), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.34, 0.17), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.34, 0.83), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0.33), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0.67), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0.33), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0.67), false));

	return (constr);
};

