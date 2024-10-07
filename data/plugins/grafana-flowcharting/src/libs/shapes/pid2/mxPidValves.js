/**
 * $Id: mxPidValves.js,v 1.5 2013/10/22 12:55:55 mate Exp $
 * Copyright (c) 2006-2013, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Valve
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapePidValve(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapePidValve, mxShape);

mxShapePidValve.prototype.cst = {
		SHAPE_VALVE : 'mxgraph.pid2valves.valve',
		//states
		DEFAULT_STATE : 'defState',
		CLOSED : 'closed',
		OPEN : 'open',
		//actuators
		ACTUATOR : 'actuator',
		MANUAL : 'man',
		DIAPHRAGM : 'diaph',
		BALANCED_DIAPHRAGM : 'balDiaph',
		MOTOR : 'motor',
		NONE : 'none',
		SPRING : 'spring',
		PILOT : 'pilot',
		POWERED: 'powered',
		SOLENOID : 'solenoid',
		SOLENOID_MANUAL_RESET : 'solenoidManRes',
		SINGLE_ACTING : 'singActing',
		DOUBLE_ACTING : 'dblActing',
		PILOT_CYLINDER : 'pilotCyl',
		DIGITAL : 'digital',
		WEIGHT : 'weight',
		KEY : 'key',
		ELECTRO_HYDRAULIC : 'elHyd',
		//types
		VALVE_TYPE : 'valveType',
		BUTTERFLY : 'butterfly',
		CHECK : 'check',
		GATE : 'gate',
		GLOBE : 'globe',
		NEEDLE : 'needle',
		PLUG : 'plug',
		SELF_DRAINING : 'selfDrain',
		ANGLE : 'angle',
		ANGLE_GLOBE : 'angleGlobe',
		THREE_WAY : 'threeWay',
		ANGLE_BLOWDOWN : 'angBlow',
		BALL : 'ball'
};

mxShapePidValve.prototype.customProperties = [
	{name: 'defState', dispName: 'Default State', type: 'enum', defVal:'open',
		enumList: [
			{val:'closed', dispName:'Closed'},
			{val:'open', dispName:'Open'}
	]},
	{name: 'actuator', dispName: 'Actuator', type: 'enum', defVal:'man',
		enumList: [
			{val:'man', dispName:'Manual'},
			{val:'diaph', dispName:'Diphragm'},
			{val:'balDiaph', dispName:'Balanced Diaphragm'},
			{val:'motor', dispName:'Motor'},
			{val:'none', dispName:'None'},
			{val:'spring', dispName:'Spring'},
			{val:'pilot', dispName:'Pilot'},
			{val:'powered', dispName:'Powered'},
			{val:'solenoid', dispName:'Solenoid'},
			{val:'solenoidManRes', dispName:'Solenoid w/ Manual Reset'},
			{val:'singActing', dispName:'Single Acting'},
			{val:'dblActing', dispName:'Double Acting'},
			{val:'pilotCyl', dispName:'Pilot Cylinder'},
			{val:'digital', dispName:'Digital'},
			{val:'weight', dispName:'Weight'},
			{val:'key', dispName:'Key'},
			{val:'elHyd', dispName:'Electro-Hidraulic'}
	]},
	{name: 'valveType', dispName: 'Type', type: 'enum', defVal:'gate',
		enumList: [
			{val:'butterfly', dispName:'Butterfly'},
			{val:'check', dispName:'check'},
			{val:'gate', dispName:'Gate'},
			{val:'globe', dispName:'Globe'},
			{val:'needle', dispName:'Needle'},
			{val:'plug', dispName:'Plug'},
			{val:'selfDrain', dispName:'Self Draining'},
			{val:'angle', dispName:'Angle'},
			{val:'angleGlobe', dispName:'Angle Globe'},
			{val:'threeWay', dispName:'Three Way'},
//			{val:'angBlow', dispName:'Angle Blowdown'},
			{val:'ball', dispName:'Ball'}
	]},
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapePidValve.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var valveType = mxUtils.getValue(this.style, mxShapePidValve.prototype.cst.VALVE_TYPE, 'gate');
	var actuator = mxUtils.getValue(this.style, mxShapePidValve.prototype.cst.ACTUATOR, mxShapePidValve.prototype.cst.NONE);
	var actH = 0;

	if (actuator !== 'none')
	{
		if (this.isAngleVariant(valveType))
		{
			actH = h * 0.3333;
		}
		else
		{
			actH = h * 0.4;
		}
	}

	c.translate(x, y);
	c.setLineJoin('round');
	
	this.background(c, x, y, w, h, valveType, actuator, actH);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, valveType, actuator, actH);
};

mxShapePidValve.prototype.background = function(c, x, y, w, h, valveType, actuator, actH)
{
	//draw the actuator
	if (actuator !== mxShapePidValve.prototype.cst.NONE)
	{
		if (this.isAngleVariant(valveType))
		{
			this.drawActuatorBg(c, x, y, w, h / 1.2, actuator, actH);
		}
		else
		{
			this.drawActuatorBg(c, x, y, w, h, actuator, actH);
		}
	}

	//draw the valve body
	if (this.isGateVariant(valveType))
	{
		this.drawGateVariantBg(c, 0, 0, w, h, valveType, actuator, actH);
	}
	else if (this.isAngleVariant(valveType))
	{
		this.drawAngleVariantBg(c, 0, 0, w, h, valveType, actuator, actH);
	}
	else if (valveType === mxShapePidValve.prototype.cst.BUTTERFLY)
	{
		this.drawButterflyValve(c, 0, 0, w, h, actuator, actH);
	}
	else if (valveType === mxShapePidValve.prototype.cst.CHECK)
	{
		this.drawCheckValve(c, 0, 0, w, h, actuator, actH);
	}
};

mxShapePidValve.prototype.foreground = function(c, x, y, w, h, valveType, actuator, actH)
{
	var valveType = mxUtils.getValue(this.style, mxShapePidValve.prototype.cst.VALVE_TYPE, 'gate');

	//draw the actuator
	if (actuator !== mxShapePidValve.prototype.cst.NONE)
	{
		if (this.isAngleVariant(valveType))
		{
			this.drawActuatorFg(c, x, y, w, h / 1.2, actuator, actH);
		}
		else
		{
			this.drawActuatorFg(c, x, y, w, h, actuator, actH);
		}
	}

	if (this.isGateVariant(valveType))
	{
		this.drawGateVariantFg(c, 0, 0, w, h, valveType, actuator, actH);
	}
	if (this.isAngleVariant(valveType))
	{
		this.drawAngleVariantFg(c, 0, 0, w, h, valveType, actuator, actH);
	}
};

mxShapePidValve.prototype.drawActuatorBg = function(c, x, y, w, h, actuator)
{
	if (this.isSquareVariant(actuator))
	{
		c.translate(w * 0.325, 0);
		this.drawSquareAct(c, w * 0.35, h * 0.7, actuator);
		c.translate(- w * 0.325, 0);
	}
	else if (actuator === mxShapePidValve.prototype.cst.MANUAL)
	{
		c.translate(w * 0.25, h * 0.15);
		this.drawManAct(c, w * 0.5, h * 0.55);
		c.translate(- w * 0.25, - h * 0.15);
	}
	else if (actuator === mxShapePidValve.prototype.cst.DIAPHRAGM)
	{
		c.translate(w * 0.25, h * 0.1);
		this.drawDiaphAct(c, w * 0.5, h * 0.6);
		c.translate(- w * 0.25, - h * 0.1);
	}
	else if (actuator === mxShapePidValve.prototype.cst.BALANCED_DIAPHRAGM)
	{
		c.translate(w * 0.25, h * 0.1);
		this.drawBalDiaphActBg(c, w * 0.5, h * 0.6);
		c.translate(- w * 0.25, - h * 0.1);
	}
	else if (actuator === mxShapePidValve.prototype.cst.MOTOR || actuator === mxShapePidValve.prototype.cst.ELECTRO_HYDRAULIC)
	{
		c.translate(w * 0.325, 0);
		this.drawCircleAct(c, w * 0.35, h * 0.7, actuator);
		c.translate(- w * 0.325, 0);
	}
	else if (actuator === mxShapePidValve.prototype.cst.SPRING)
	{
		c.translate(w * 0.36, 0);
		this.drawSpringAct(c, w * 0.28, h * 0.7);
		c.translate(- w * 0.36, 0);
	}
	else if (actuator === mxShapePidValve.prototype.cst.SOLENOID_MANUAL_RESET)
	{
		c.translate(w * 0.325, 0);
		this.drawSolenoidManResetAct(c, w * 0.575, h * 0.7);
		c.translate(- w * 0.325, 0);
	}
	else if (actuator === mxShapePidValve.prototype.cst.SINGLE_ACTING)
	{
		c.translate(w * 0.35, 0);
		this.drawSingActingActBg(c, w * 0.65, h * 0.7);
		c.translate(- w * 0.35, 0);
	}
	else if (actuator === mxShapePidValve.prototype.cst.DOUBLE_ACTING)
	{
		c.translate(w * 0.35, 0);
		this.drawDblActingActBg(c, w * 0.65, h * 0.7);
		c.translate(- w * 0.35, 0);
	}
	else if (actuator === mxShapePidValve.prototype.cst.PILOT_CYLINDER)
	{
		c.translate(w * 0.35, 0);
		this.drawPilotCylinderActBg(c, w * 0.65, h * 0.7);
		c.translate(- w * 0.35, 0);
	}
	else if (actuator === mxShapePidValve.prototype.cst.ANGLE_BLOWDOWN)
	{
		c.translate(w * 0.5, h * 0.2);
		this.drawAngleBlowdownAct(c, w * 0.4, h * 0.5);
		c.translate(- w * 0.5, - h * 0.2);
	}
};

mxShapePidValve.prototype.drawActuatorFg = function(c, x, y, w, h, actuator)
{
	if (actuator === mxShapePidValve.prototype.cst.BALANCED_DIAPHRAGM)
	{
		c.translate(w * 0.25, h * 0.1);
		this.drawBalDiaphActFg(c, w * 0.5, h * 0.6);
		c.translate(- w * 0.25, - h * 0.1);
	}
	else if (actuator === mxShapePidValve.prototype.cst.SINGLE_ACTING || 
			actuator === mxShapePidValve.prototype.cst.DOUBLE_ACTING || 
			actuator === mxShapePidValve.prototype.cst.PILOT_CYLINDER)
	{
		c.translate(w * 0.35, 0);
		this.drawActingActFg(c, w * 0.65, h * 0.7);
		c.translate(- w * 0.35, 0);
	}
};

mxShapePidValve.prototype.drawManAct = function(c, w, h)
{
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.moveTo(w * 0.5, 0);
	c.lineTo(w * 0.5, h);
	c.stroke();
};

mxShapePidValve.prototype.drawDiaphAct = function(c, w, h)
{
	c.begin();
	c.moveTo(w * 0.5, h * 0.2);
	c.lineTo(w * 0.5, h);
	c.stroke();
	
	c.begin();
	c.moveTo(0, h * 0.2);
	c.arcTo(w * 0.6, h * 0.4, 0, 0, 1, w, h * 0.2);
	c.close();
	c.fillAndStroke();
};

mxShapePidValve.prototype.drawBalDiaphActBg = function(c, w, h)
{
	c.ellipse(0, 0, w, h * 0.3);
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.5, h * 0.3);
	c.lineTo(w * 0.5, h);
	c.stroke();
};

mxShapePidValve.prototype.drawBalDiaphActFg = function(c, w, h)
{
	c.begin();
	c.moveTo(0, h * 0.15);
	c.lineTo(w, h * 0.15);
	c.stroke();
};

mxShapePidValve.prototype.drawCircleAct = function(c, w, h, actuator)
{
	c.ellipse(0, 0, w, h * 0.5);
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.5, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.stroke();

	var m = '';
	
	if (actuator === mxShapePidValve.prototype.cst.MOTOR)
	{
		m = 'M';
	}
	else if (actuator === mxShapePidValve.prototype.cst.ELECTRO_HYDRAULIC)
	{
		m = 'E/H';
	}

	c.setFontStyle(1);
	c.setFontFamily('Helvetica');
	c.setFontSize(Math.min(w, h) * 0.4);
	c.text(w * 0.5, h * 0.25, 0, 0, m, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxShapePidValve.prototype.drawSpringAct = function(c, w, h)
{
	c.begin();
	c.moveTo(w * 0.5, 0);
	c.lineTo(w * 0.5, h);
	c.moveTo(w * 0.32, h * 0.16);
	c.lineTo(w * 0.68, h * 0.08);
	c.moveTo(w * 0.21, h * 0.32);
	c.lineTo(w * 0.79, h * 0.20);
	c.moveTo(w * 0.1, h * 0.52);
	c.lineTo(w * 0.9, h * 0.36);
	c.moveTo(0, h * 0.72);
	c.lineTo(w, h * 0.5);
	c.stroke();
};

mxShapePidValve.prototype.drawSolenoidManResetAct = function(c, w, h)
{
	c.rect(0, 0, w * 0.61, h * 0.46);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w * 0.56, h * 0.6);
	c.lineTo(w * 0.78, h * 0.5);
	c.lineTo(w, h * 0.6);
	c.lineTo(w * 0.78, h * 0.7);
	c.close();
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w * 0.305, h * 0.46);
	c.lineTo(w * 0.305, h);
	c.moveTo(w * 0.305, h * 0.6);
	c.lineTo(w * 0.56, h * 0.6);
	c.stroke();

	c.setFontStyle(1);
	c.setFontFamily('Helvetica');
	c.setFontSize(Math.min(w, h) * 0.4);
	c.text(w * 0.305, h * 0.23, 0, 0, 'S', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFontStyle(0);
	c.setFontSize(Math.min(w, h) * 0.15);
	c.text(w * 0.78, h * 0.6, 0, 0, 'R', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxShapePidValve.prototype.drawSingActingActBg = function(c, w, h)
{
	c.rect(0, 0, w * 0.46, h * 0.46);
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.23, h * 0.46);
	c.lineTo(w * 0.23, h);
	c.moveTo(w * 0.46, h * 0.23);
	c.lineTo(w, h * 0.23);
	c.moveTo(w * 0.77, h * 0.15);
	c.lineTo(w * 0.69, h * 0.31);
	c.moveTo(w * 0.82, h * 0.15);
	c.lineTo(w * 0.74, h * 0.31);
	c.stroke();
};

mxShapePidValve.prototype.drawActingActFg = function(c, w, h)
{
	c.begin();
	c.moveTo(w * 0.23, h * 0.23);
	c.lineTo(w * 0.23, h * 0.46);
	c.moveTo(0, h * 0.23);
	c.lineTo(w * 0.46, h * 0.23);
	c.stroke();
};

mxShapePidValve.prototype.drawDblActingActBg = function(c, w, h)
{
	c.rect(0, 0, w * 0.46, h * 0.46);
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.23, h * 0.46);
	c.lineTo(w * 0.23, h);
	c.moveTo(w * 0.46, h * 0.115);
	c.lineTo(w, h * 0.115);
	c.moveTo(w * 0.77, h * 0.035);
	c.lineTo(w * 0.69, h * 0.195);
	c.moveTo(w * 0.82, h * 0.035);
	c.lineTo(w * 0.74, h * 0.195);
	c.moveTo(w * 0.46, h * 0.345);
	c.lineTo(w, h * 0.345);
	c.moveTo(w * 0.77, h * 0.265);
	c.lineTo(w * 0.69, h * 0.425);
	c.moveTo(w * 0.82, h * 0.265);
	c.lineTo(w * 0.74, h * 0.425);
	c.stroke();
};

mxShapePidValve.prototype.drawPilotCylinderActBg = function(c, w, h)
{
	c.rect(0, 0, w * 0.46, h * 0.46);
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.23, h * 0.46);
	c.lineTo(w * 0.23, h);
	c.moveTo(w * 0.46, h * 0.23);
	c.lineTo(w * 0.77, h * 0.23);
	c.stroke();
	
	c.rect(w * 0.77, h * 0.115, w * 0.23, h * 0.23);
	c.fillAndStroke();

	c.setFontStyle(0);
	c.setFontFamily('Helvetica');
	c.setFontSize(Math.min(w, h) * 0.15);
	c.text(w * 0.885, h * 0.23, 0, 0, 'P', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxShapePidValve.prototype.drawAngleBlowdownAct = function(c, w, h)
{
	c.begin();
	c.moveTo(w * 0.34, 0);
	c.lineTo(w, h * 0.405);
	c.moveTo(0, h);
	c.lineTo(w * 0.665, h * 0.205);
	c.stroke();
};

mxShapePidValve.prototype.drawSquareAct = function(c, w, h, actuator)
{
	c.rect(0, 0, w, h * 0.5);
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.5, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.stroke();

	var m = '';
	
	if (actuator === mxShapePidValve.prototype.cst.PILOT)
	{
		m = 'P';
	}
	else if (actuator === mxShapePidValve.prototype.cst.SOLENOID)
	{
		m = 'S';
	}
	else if (actuator === mxShapePidValve.prototype.cst.DIGITAL)
	{
		m = 'D';
	}
	else if (actuator === mxShapePidValve.prototype.cst.WEIGHT)
	{
		m = 'W';
	}
	else if (actuator === mxShapePidValve.prototype.cst.KEY)
	{
		m = 'K';
	}
	
	c.setFontStyle(1);
	c.setFontFamily('Helvetica');
	c.setFontSize(Math.min(w, h) * 0.4);
	c.text(w * 0.5, h * 0.25, 0, 0, m, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxShapePidValve.prototype.drawGateVariantFg = function(c, x, y, w, h, valveType, actuator, actH)
{
	var defState = mxUtils.getValue(this.style, mxShapePidValve.prototype.cst.DEFAULT_STATE, 'open');
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	
	if (valveType === mxShapePidValve.prototype.cst.BALL)
	{
		c.ellipse(x + w * 0.3, y + actH + (h - actH) * 0.18, w * 0.4, (h - actH) * 0.64);
		c.fillAndStroke();
	}
	else if (valveType === mxShapePidValve.prototype.cst.GLOBE)
	{
		c.ellipse(x + w * 0.3, y + actH + (h - actH) * 0.18, w * 0.4, (h - actH) * 0.64);
		c.setFillColor(strokeColor);
		c.fillAndStroke();
		c.setFillColor(fillColor);
	}
	else if (valveType === mxShapePidValve.prototype.cst.PLUG)
	{
		this.drawPlug(c, x + w * 0.4, y + actH + (h - actH) * 0.25, w * 0.2, (h - actH) * 0.5);
	}
	else if (valveType === mxShapePidValve.prototype.cst.NEEDLE)
	{
		this.drawNeedle(c, x + w * 0.45, y + actH + (h - actH) * 0.1, w * 0.1, (h - actH) * 0.9);
	}
	else if (valveType === mxShapePidValve.prototype.cst.SELF_DRAINING)
	{
		this.drawDrain(c, x + w * 0.48, y + actH + (h - actH) * 0.5, w * 0.04, (h - actH) * 0.49);
	}
};

mxShapePidValve.prototype.drawAngleVariantFg = function(c, x, y, w, h, valveType, actuator, actH)
{
	var defState = mxUtils.getValue(this.style, mxShapePidValve.prototype.cst.DEFAULT_STATE, 'open');
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	
	if (valveType === mxShapePidValve.prototype.cst.ANGLE_GLOBE)
	{
		if (actuator === 'none')
		{
			c.ellipse(w * 0.34, h * 0.175, w * 0.32, h * 0.4);
		}
		else
		{
			c.ellipse(w * 0.34, h * 0.45, w * 0.32, h * 0.2667);
		}
		c.setFillColor(strokeColor);
		c.fillAndStroke();
		c.setFillColor(fillColor);
	}
};

mxShapePidValve.prototype.drawGateVariantBg = function(c, x, y, w, h, valveType, actuator, actH)
{
	if (valveType === mxShapePidValve.prototype.cst.GATE)
	{
		this.drawGateValve(c, x, y + actH, w, h - actH);
	}
	else if (valveType === mxShapePidValve.prototype.cst.BALL || valveType === mxShapePidValve.prototype.cst.GLOBE)
	{
		c.ellipse(x + w * 0.3, y + actH + (h - actH) * 0.18, w * 0.4, (h - actH) * 0.64);
		c.fillAndStroke();
		this.drawGateValve(c, x, y + actH, w, h - actH);
	}
	else if (valveType === mxShapePidValve.prototype.cst.PLUG)
	{
		this.drawPlug(c, x + w * 0.4, y + actH + (h - actH) * 0.25, w * 0.2, (h - actH) * 0.5);
		this.drawGateValve(c, x, y + actH, w, h - actH);
	}
	else if (valveType === mxShapePidValve.prototype.cst.NEEDLE)
	{
		this.drawNeedle(c, x + w * 0.45, y + actH + (h - actH) * 0.1, w * 0.1, (h - actH) * 0.9);
		this.drawGateValve(c, x, y + actH, w, h - actH);
	}
	else if (valveType === mxShapePidValve.prototype.cst.SELF_DRAINING)
	{
		this.drawDrain(c, x + w * 0.48, y + actH + (h - actH) * 0.5, w * 0.04, (h - actH) * 0.49);
		this.drawGateValve(c, x, y + actH, w, h - actH);
	}
};

mxShapePidValve.prototype.drawAngleVariantBg = function(c, x, y, w, h, valveType, actuator, actH)
{
	if (valveType === mxShapePidValve.prototype.cst.ANGLE)
	{
		this.drawAngleValve(c, w * 0.2, y + actH, w * 0.8, h - actH);
	}
	else if (valveType === mxShapePidValve.prototype.cst.ANGLE_GLOBE)
	{
		this.drawAngleGlobeValveBg(c, w * 0.2, y + actH, w * 0.8, h - actH);
	}
	else if (valveType === mxShapePidValve.prototype.cst.THREE_WAY)
	{
		this.drawThreeWayValve(c, 0, y + actH, w, h - actH);
	}
	else if (valveType === mxShapePidValve.prototype.cst.ANGLE_BLOWDOWN)
	{
		this.drawAngleBlowdownValve(c, x, y + actH, w, h - actH);
	}
};

mxShapePidValve.prototype.drawPlug = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
	c.translate(-x, -y);
};

mxShapePidValve.prototype.drawNeedle = function(c, x, y, w, h)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');

	c.translate(x, y);
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w * 0.5, h);
	c.close();
	c.setFillColor(strokeColor);
	c.fillAndStroke();
	c.setFillColor(fillColor);
	c.translate(-x, -y);
};

mxShapePidValve.prototype.drawDrain = function(c, x, y, w, h)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');

	c.translate(x, y);
	c.begin();
	c.moveTo(w * 0.5, 0);
	c.lineTo(w * 0.5, h * 0.96);
	c.stroke();

	c.begin();
	c.moveTo(0, h * 0.9);
	c.lineTo(w, h * 0.9);
	c.lineTo(w * 0.5, h);
	c.close();
	c.setFillColor(strokeColor);
	c.fillAndStroke();
	c.setFillColor(fillColor);
	c.translate(-x, -y);
};

mxShapePidValve.prototype.drawGateValve = function(c, x, y, w, h)
{
	var defState = mxUtils.getValue(this.style, mxShapePidValve.prototype.cst.DEFAULT_STATE, 'open');
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');

	c.translate(x, y);
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w * 0.5, h * 0.5);
	c.lineTo(0, h);
	c.close();
	c.moveTo(w, 0);
	c.lineTo(w * 0.5, h * 0.5);
	c.lineTo(w, h);
	c.close();

	if (defState === mxShapePidValve.prototype.cst.CLOSED)
	{
		c.setFillColor(strokeColor);
		c.fillAndStroke();
		c.setFillColor(fillColor);
	}
	else
	{
		c.fillAndStroke();
	}

	c.translate(-x, -y);
};

mxShapePidValve.prototype.drawAngleValve = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(w * 0.375, h * 0.375);
	c.lineTo(w, 0);
	c.lineTo(w, h * 0.75);
	c.close();
	c.moveTo(w * 0.375, h * 0.375);
	c.lineTo(w * 0.75, h);
	c.lineTo(0, h);
	c.close();
	c.fillAndStroke();

	c.translate(-x, -y);
};

mxShapePidValve.prototype.drawAngleGlobeValveBg = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.ellipse(w * 0.175, h * 0.175, w * 0.4, h * 0.4);
	c.fillAndStroke();
	c.begin();
	c.moveTo(w * 0.375, h * 0.375);
	c.lineTo(w, 0);
	c.lineTo(w, h * 0.75);
	c.close();
	c.moveTo(w * 0.375, h * 0.375);
	c.lineTo(w * 0.75, h);
	c.lineTo(0, h);
	c.close();
	c.fillAndStroke();
	c.translate(-x, -y);
};

mxShapePidValve.prototype.drawAngleGlobeValveFg = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.ellipse(w * 0.275, h * 0.275, w * 0.2, h * 0.2);
	c.fillAndStroke();
	c.translate(-x, -y);
};

mxShapePidValve.prototype.drawThreeWayValve = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w * 0.5, h * 0.375);
	c.lineTo(0, h * 0.75);
	c.close();
	
	c.moveTo(w, 0);
	c.lineTo(w * 0.5, h * 0.375);
	c.lineTo(w, h * 0.75);
	c.close();
	
	c.moveTo(w * 0.5, h * 0.375);
	c.lineTo(w * 0.8, h);
	c.lineTo(w * 0.2, h);
	c.close();
	c.fillAndStroke();

	c.translate(-x, -y);
};

mxShapePidValve.prototype.drawAngleBlowdownValve = function(c, x, y, w, h)
{
	
};

	
mxShapePidValve.prototype.drawButterflyValve = function(c, x, y, w, h, actuator, actH)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');

	var yv = y + actH;
	var hv = h - actH;

	c.translate(x, yv);
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(0, hv);
	c.moveTo(w, 0);
	c.lineTo(w, hv);

	c.moveTo(w * 0.05, hv * 0.05);
	c.lineTo(w * 0.95, hv * 0.95);
	
	c.fillAndStroke();

	c.ellipse(w * 0.4, hv * 0.33, w * 0.2, hv * 0.33);
	c.fillAndStroke();
	
	c.translate(-x, -y);
};

mxShapePidValve.prototype.drawCheckValve = function(c, x, y, w, h, actuator, actH)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');

	var yv = y + actH;
	var hv = h - actH;

	c.translate(x, yv);
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(0, hv);
	c.moveTo(w, 0);
	c.lineTo(w, hv);
	c.moveTo(w * 0.05, hv * 0.05);
	c.lineTo(w * 0.95, hv * 0.95);
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.8925, hv * 0.815);
	c.lineTo(w * 0.957, hv * 0.955);
	c.lineTo(w * 0.85, hv * 0.928);
	c.close();
	c.setFillColor(strokeColor);
	c.fillAndStroke();
	c.setFillColor(fillColor);
	
	c.translate(-x, -y);
};

mxShapePidValve.prototype.isGateVariant = function(valveType)
{
	if (valveType === mxShapePidValve.prototype.cst.GATE || 
			valveType === mxShapePidValve.prototype.cst.BALL ||
			valveType === mxShapePidValve.prototype.cst.PLUG ||
			valveType === mxShapePidValve.prototype.cst.NEEDLE ||
			valveType === mxShapePidValve.prototype.cst.SELF_DRAINING ||
			valveType === mxShapePidValve.prototype.cst.GLOBE)
	{
		return true;
	}
	else
	{
		return false;
	}
};

mxShapePidValve.prototype.isAngleVariant = function(valveType)
{
	if (valveType === mxShapePidValve.prototype.cst.ANGLE || 
			valveType === mxShapePidValve.prototype.cst.ANGLE_GLOBE ||
			valveType === mxShapePidValve.prototype.cst.THREE_WAY ||
			valveType === mxShapePidValve.prototype.cst.ANGLE_BLOWDOWN)
	{
		return true;
	}
	else
	{
		return false;
	}
};

mxShapePidValve.prototype.isSquareVariant = function(actType)
{
	if (actType === mxShapePidValve.prototype.cst.PILOT || 
			actType === mxShapePidValve.prototype.cst.SOLENOID ||
			actType === mxShapePidValve.prototype.cst.POWERED ||
			actType === mxShapePidValve.prototype.cst.DIGITAL ||
			actType === mxShapePidValve.prototype.cst.WEIGHT ||
			actType === mxShapePidValve.prototype.cst.KEY)
	{
		return true;
	}
	else
	{
		return false;
	}
};

mxCellRenderer.registerShape(mxShapePidValve.prototype.cst.SHAPE_VALVE, mxShapePidValve);

//**********************************************************************************************************************************************************
//Integrated Block And Bleed Valve
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapePidIntBlockBleedValve(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
* Extends mxShapePidValve.
*/
mxUtils.extend(mxShapePidIntBlockBleedValve, mxShapePidValve);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapePidIntBlockBleedValve.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var actuator = mxUtils.getValue(this.style, mxShapePidIntBlockBleedValve.prototype.cst.ACTUATOR, mxShapePidIntBlockBleedValve.prototype.cst.NONE);
	var actH = 0;

	if (actuator !== 'none')
	{
		actH = h * 0.2353;
	}

	c.translate(x, y);
	c.setLineJoin('round');
	
	this.background(c, x, y, w, h, actuator, actH);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, actuator, actH);
};

mxShapePidIntBlockBleedValve.prototype.background = function(c, x, y, w, h, actuator, actH)
{
	//draw the actuator
	if (actuator !== mxShapePidIntBlockBleedValve.prototype.cst.NONE)
	{
		this.drawActuatorBg(c, x, y, w, h, actuator);
	}

	//draw the valve body
	this.drawValveBg(c, 0, actH, w, h - actH);
};

mxShapePidIntBlockBleedValve.prototype.foreground = function(c, x, y, w, h, actuator, actH)
{
	//draw the actuator
	if (actuator !== mxShapePidIntBlockBleedValve.prototype.cst.NONE)
	{
		this.drawActuatorFg(c, x, y, w, h, actuator);
	}
};

mxShapePidIntBlockBleedValve.prototype.drawValveBg = function(c, x, y, w, h)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');

	c.translate(x, y);
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w * 0.5, h * 0.23);
	c.lineTo(0, h * 0.46);
	c.close();
	c.moveTo(w * 0.5, h * 0.23);
	c.lineTo(w, 0);
	c.lineTo(w, h * 0.46);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.5, h * 0.23);
	c.lineTo(w * 0.5, h * 0.5);
	c.stroke();
	
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.3, h * 0.5);
	c.lineTo(w * 0.7, h * 0.5);
	c.lineTo(w * 0.5, h * 0.75);
	c.close();
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w * 0.3, h);
	c.lineTo(w * 0.5, h * 0.75);
	c.lineTo(w * 0.7, h);
	c.fillAndStroke();
	c.setFillColor(fillColor);

	c.translate(-x, -y);
};

mxShapePidIntBlockBleedValve.prototype.drawActuatorBg = function(c, x, y, w, h, actuator)
{
	if (this.isSquareVariant(actuator))
	{
		c.translate(w * 0.325, 0);
		this.drawSquareAct(c, w * 0.35, h * 0.4112, actuator);
		c.translate(- w * 0.325, 0);
	}
	else if (actuator === mxShapePidIntBlockBleedValve.prototype.cst.MANUAL)
	{
		c.translate(w * 0.25, h * 0.0882);
		this.drawManAct(c, w * 0.5, h * 0.323);
		c.translate(- w * 0.25, - h * 0.0882);
	}
	else if (actuator === mxShapePidIntBlockBleedValve.prototype.cst.DIAPHRAGM)
	{
		c.translate(w * 0.25, h * 0.0588);
		this.drawDiaphAct(c, w * 0.5, h * 0.3524);
		c.translate(- w * 0.25, - h * 0.0588);
	}
	else if (actuator === mxShapePidIntBlockBleedValve.prototype.cst.BALANCED_DIAPHRAGM)
	{
		c.translate(w * 0.25, h * 0.0588);
		this.drawBalDiaphActBg(c, w * 0.5, h * 0.3524);
		c.translate(- w * 0.25, - h * 0.0588);
	}
	else if (actuator === mxShapePidIntBlockBleedValve.prototype.cst.MOTOR || actuator === mxShapePidIntBlockBleedValve.prototype.cst.ELECTRO_HYDRAULIC)
	{
		c.translate(w * 0.325, 0);
		this.drawCircleAct(c, w * 0.35, h * 0.4112, actuator);
		c.translate(- w * 0.325, 0);
	}
	else if (actuator === mxShapePidIntBlockBleedValve.prototype.cst.SPRING)
	{
		c.translate(w * 0.36, 0);
		this.drawSpringAct(c, w * 0.28, h * 0.4112);
		c.translate(- w * 0.36, 0);
	}
	else if (actuator === mxShapePidIntBlockBleedValve.prototype.cst.SOLENOID_MANUAL_RESET)
	{
		c.translate(w * 0.325, 0);
		this.drawSolenoidManResetAct(c, w * 0.575, h * 0.4112);
		c.translate(- w * 0.325, 0);
	}
	else if (actuator === mxShapePidIntBlockBleedValve.prototype.cst.SINGLE_ACTING)
	{
		c.translate(w * 0.35, 0);
		this.drawSingActingActBg(c, w * 0.65, h * 0.4112);
		c.translate(- w * 0.35, 0);
	}
	else if (actuator === mxShapePidIntBlockBleedValve.prototype.cst.DOUBLE_ACTING)
	{
		c.translate(w * 0.35, 0);
		this.drawDblActingActBg(c, w * 0.65, h * 0.4112);
		c.translate(- w * 0.35, 0);
	}
	else if (actuator === mxShapePidIntBlockBleedValve.prototype.cst.PILOT_CYLINDER)
	{
		c.translate(w * 0.35, 0);
		this.drawPilotCylinderActBg(c, w * 0.65, h * 0.4112);
		c.translate(- w * 0.35, 0);
	}
};

mxShapePidIntBlockBleedValve.prototype.drawActuatorFg = function(c, x, y, w, h, actuator)
{
	if (actuator === mxShapePidIntBlockBleedValve.prototype.cst.BALANCED_DIAPHRAGM)
	{
		c.translate(w * 0.25, h * 0.0588);
		this.drawBalDiaphActFg(c, w * 0.5, h * 0.3524);
		c.translate(- w * 0.25, - h * 0.0588);
	}
	else if (actuator === mxShapePidIntBlockBleedValve.prototype.cst.SINGLE_ACTING || 
			actuator === mxShapePidIntBlockBleedValve.prototype.cst.DOUBLE_ACTING || 
			actuator === mxShapePidIntBlockBleedValve.prototype.cst.PILOT_CYLINDER)
	{
		c.translate(w * 0.35, 0);
		this.drawActingActFg(c, w * 0.65, h * 0.4112);
		c.translate(- w * 0.35, 0);
	}
};

mxCellRenderer.registerShape('mxgraph.pid2valves.blockBleedValve', mxShapePidIntBlockBleedValve);

//**********************************************************************************************************************************************************
//Auto Recirculation Valve
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapePidAutoRecircValve(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapePidAutoRecircValve, mxShape);


/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapePidAutoRecircValve.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.setLineJoin('round');
	c.translate(x, y);

	//background
	c.rect(0, 0, w, h);
	c.fillAndStroke();
	c.setShadow(false);

	//foreground
	c.begin();
	c.moveTo(w * 0.08, h * 0.08);
	c.lineTo(w * 0.08, h * 0.92);
	c.moveTo(w * 0.92, h * 0.08);
	c.lineTo(w * 0.92, h * 0.92);
	c.moveTo(w * 0.12, h * 0.122);
	c.lineTo(w * 0.8738, h * 0.8837);
	
	c.moveTo(w * 0.5, 0);
	c.lineTo(w * 0.55, h * 0.05);
	c.lineTo(w * 0.45, h * 0.15);
	c.lineTo(w * 0.55, h * 0.25);
	c.lineTo(w * 0.45, h * 0.35);
	c.lineTo(w * 0.55, h * 0.45);
	c.lineTo(w * 0.49, h * 0.5);
	c.stroke();
	
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	
	c.begin();
	c.moveTo(w * 0.8257, h * 0.7695);
	c.lineTo(w * 0.8797, h * 0.888);
	c.lineTo(w * 0.79, h * 0.8651);
	c.close();
	c.setFillColor(strokeColor);
	c.fillAndStroke();
	c.setFillColor(fillColor);
};

mxCellRenderer.registerShape('mxgraph.pid2valves.autoRecircValve', mxShapePidAutoRecircValve);
