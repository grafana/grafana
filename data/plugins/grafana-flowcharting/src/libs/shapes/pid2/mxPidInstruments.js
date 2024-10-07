/**
 * $Id: mxPidInstruments.js,v 1.4 2014/01/21 13:10:17 gaudenz Exp $
 * Copyright (c) 2006-2013, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Discrete Instrument
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapePidDiscInst(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapePidDiscInst, mxShape);

mxShapePidDiscInst.prototype.cst = {
		SHAPE_DISC_INST : 'mxgraph.pid2inst.discInst',
		MOUNTING : 'mounting',
		FIELD : 'field',
		ROOM : 'room',
		INACCESSIBLE : 'inaccessible',
		LOCAL : 'local'
};

mxShapePidDiscInst.prototype.customProperties = [
	{name: 'mounting', dispName: 'Mounting', type: 'enum', defVal:'field',
		enumList: [
			{val:'field', dispName:'Field'},
			{val:'room', dispName:'Room'},
			{val:'inaccessible', dispName:'Inaccessible'},
			{val:'local', dispName:'Local'}
		]}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapePidDiscInst.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapePidDiscInst.prototype.background = function(c, x, y, w, h)
{
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
};

mxShapePidDiscInst.prototype.foreground = function(c, x, y, w, h)
{
	var mounting = mxUtils.getValue(this.style, mxShapePidDiscInst.prototype.cst.MOUNTING, 'field');

	if (mounting === mxShapePidDiscInst.prototype.cst.ROOM)
	{
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
	else if (mounting === mxShapePidDiscInst.prototype.cst.INACCESSIBLE)
	{
		c.setDashed(true);
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
	else if (mounting === mxShapePidDiscInst.prototype.cst.LOCAL)
	{
		c.begin();
		c.moveTo(w * 0.005, h * 0.48);
		c.lineTo(w * 0.995, h * 0.48);
		c.moveTo(w * 0.005, h * 0.52);
		c.lineTo(w * 0.995, h * 0.52);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapePidDiscInst.prototype.cst.SHAPE_DISC_INST, mxShapePidDiscInst);

mxShapePidDiscInst.prototype.constraints = [
                    new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                    new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                    new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                    new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                    new mxConnectionConstraint(new mxPoint(0.145, 0.145), false),
                    new mxConnectionConstraint(new mxPoint(0.145, 0.855), false),
                    new mxConnectionConstraint(new mxPoint(0.855, 0.145), false),
                    new mxConnectionConstraint(new mxPoint(0.855, 0.855), false)
                    ];

//**********************************************************************************************************************************************************
//Shared Control/Display
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapePidSharedCont(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapePidSharedCont, mxShape);

mxShapePidSharedCont.prototype.cst = {
		SHAPE_SHARED_CONT : 'mxgraph.pid2inst.sharedCont',
		MOUNTING : 'mounting',
		FIELD : 'field',
		ROOM : 'room',
		INACCESSIBLE : 'inaccessible',
		LOCAL : 'local'
};

mxShapePidSharedCont.prototype.customProperties = [
	{name: 'mounting', dispName: 'Mounting', type: 'enum', defVal:'field',
		enumList: [
			{val:'field', dispName:'Field'},
			{val:'room', dispName:'Room'},
			{val:'inaccessible', dispName:'Inaccessible'},
			{val:'local', dispName:'Local'}
		]}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapePidSharedCont.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapePidSharedCont.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapePidSharedCont.prototype.foreground = function(c, x, y, w, h)
{
	var mounting = mxUtils.getValue(this.style, mxShapePidSharedCont.prototype.cst.MOUNTING, 'field');

	c.ellipse(0, 0, w, h);
	c.fillAndStroke();

	if (mounting === mxShapePidSharedCont.prototype.cst.ROOM)
	{
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
	else if (mounting === mxShapePidSharedCont.prototype.cst.INACCESSIBLE)
	{
		c.setDashed(true);
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
	else if (mounting === mxShapePidDiscInst.prototype.cst.LOCAL)
	{
		c.begin();
		c.moveTo(w * 0.005, h * 0.48);
		c.lineTo(w * 0.995, h * 0.48);
		c.moveTo(w * 0.005, h * 0.52);
		c.lineTo(w * 0.995, h * 0.52);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapePidSharedCont.prototype.cst.SHAPE_SHARED_CONT, mxShapePidSharedCont);

mxShapePidSharedCont.prototype.constraints = [
                                            new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                            new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                            new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                            new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                            new mxConnectionConstraint(new mxPoint(0, 0), false),
                                            new mxConnectionConstraint(new mxPoint(0, 1), false),
                                            new mxConnectionConstraint(new mxPoint(1, 0), false),
                                            new mxConnectionConstraint(new mxPoint(1, 1), false)
                                            ];

//**********************************************************************************************************************************************************
//Computer Function
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapePidCompFunc(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapePidCompFunc, mxShape);

mxShapePidCompFunc.prototype.cst = {
		SHAPE_COMP_FUNC : 'mxgraph.pid2inst.compFunc',
		MOUNTING : 'mounting',
		FIELD : 'field',
		ROOM : 'room',
		INACCESSIBLE : 'inaccessible',
		LOCAL : 'local'
};

mxShapePidCompFunc.prototype.customProperties = [
	{name: 'mounting', dispName: 'Mounting', type: 'enum', defVal:'field',
		enumList: [
			{val:'field', dispName:'Field'},
			{val:'room', dispName:'Room'},
			{val:'inaccessible', dispName:'Inaccessible'},
			{val:'local', dispName:'Local'}
		]}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapePidCompFunc.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapePidCompFunc.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w * 0.25, 0);
	c.lineTo(w * 0.75, 0);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.75, h);
	c.lineTo(w * 0.25, h);
	c.close();
	c.fillAndStroke();
};

mxShapePidCompFunc.prototype.foreground = function(c, x, y, w, h)
{
	var mounting = mxUtils.getValue(this.style, mxShapePidCompFunc.prototype.cst.MOUNTING, 'field');

	if (mounting === mxShapePidCompFunc.prototype.cst.ROOM)
	{
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
	else if (mounting === mxShapePidCompFunc.prototype.cst.INACCESSIBLE)
	{
		c.setDashed(true);
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
	else if (mounting === mxShapePidDiscInst.prototype.cst.LOCAL)
	{
		c.begin();
		c.moveTo(w * 0.01, h * 0.48);
		c.lineTo(w * 0.99, h * 0.48);
		c.moveTo(w * 0.01, h * 0.52);
		c.lineTo(w * 0.99, h * 0.52);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapePidCompFunc.prototype.cst.SHAPE_COMP_FUNC, mxShapePidCompFunc);

mxShapePidCompFunc.prototype.constraints = [
                                              new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                              new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                              new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                              new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                              new mxConnectionConstraint(new mxPoint(0.25, 0), false),
                                              new mxConnectionConstraint(new mxPoint(0.75, 0), false),
                                              new mxConnectionConstraint(new mxPoint(0.25, 1), false),
                                              new mxConnectionConstraint(new mxPoint(0.75, 1), false)
                                              ];

//**********************************************************************************************************************************************************
//Computer Function
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapePidProgLogCont(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapePidProgLogCont, mxShape);

mxShapePidProgLogCont.prototype.cst = {
		SHAPE_PROG_LOG_CONT : 'mxgraph.pid2inst.progLogCont',
		MOUNTING : 'mounting',
		FIELD : 'field',
		ROOM : 'room',
		INACCESSIBLE : 'inaccessible',
		LOCAL : 'local'
};

mxShapePidProgLogCont.prototype.customProperties = [
	{name: 'mounting', dispName: 'Mounting', type: 'enum', defVal:'field',
		enumList: [
			{val:'field', dispName:'Field'},
			{val:'room', dispName:'Room'},
			{val:'inaccessible', dispName:'Inaccessible'},
			{val:'local', dispName:'Local'}
		]}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapePidProgLogCont.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapePidProgLogCont.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapePidProgLogCont.prototype.foreground = function(c, x, y, w, h)
{
	var mounting = mxUtils.getValue(this.style, mxShapePidProgLogCont.prototype.cst.MOUNTING, 'field');

	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
	
	if (mounting === mxShapePidProgLogCont.prototype.cst.ROOM)
	{
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
	else if (mounting === mxShapePidProgLogCont.prototype.cst.INACCESSIBLE)
	{
		c.setDashed(true);
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
	else if (mounting === mxShapePidDiscInst.prototype.cst.LOCAL)
	{
		c.begin();
		c.moveTo(w * 0.02, h * 0.48);
		c.lineTo(w * 0.98, h * 0.48);
		c.moveTo(w * 0.02, h * 0.52);
		c.lineTo(w * 0.98, h * 0.52);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapePidProgLogCont.prototype.cst.SHAPE_PROG_LOG_CONT, mxShapePidProgLogCont);

mxShapePidProgLogCont.prototype.constraints = [
                                            new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                            new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                            new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                            new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                            new mxConnectionConstraint(new mxPoint(0, 0), false),
                                            new mxConnectionConstraint(new mxPoint(0, 1), false),
                                            new mxConnectionConstraint(new mxPoint(1, 0), false),
                                            new mxConnectionConstraint(new mxPoint(1, 1), false)
                                            ];

//**********************************************************************************************************************************************************
//Indicator
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapePidIndicator(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapePidIndicator, mxShape);

mxShapePidIndicator.prototype.cst = {
		SHAPE_INDICATOR : 'mxgraph.pid2inst.indicator',
		MOUNTING : 'mounting',
		FIELD : 'field',
		ROOM : 'room',
		INACCESSIBLE : 'inaccessible',
		LOCAL : 'local',
		IND_TYPE : 'indType',
		INSTRUMENT : 'inst',
		CONTROL : 'ctrl',
		FUNCTION : 'func',
		PLC : 'plc'
};

mxShapePidIndicator.prototype.customProperties = [
	{name: 'mounting', dispName: 'Mounting', type: 'enum', defVal:'field',
		enumList: [
			{val:'field', dispName:'Field'},
			{val:'room', dispName:'Room'},
			{val:'inaccessible', dispName:'Inaccessible'},
			{val:'local', dispName:'Local'}
	]},
	{name: 'indType', dispName: 'Type', type: 'enum', defVal:'inst',
		enumList: [
			{val:'inst', dispName:'Instrument'},
			{val:'ctrl', dispName:'Control'},
			{val:'func', dispName:'Function'},
			{val:'plc', dispName:'PLC'}
	]}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapePidIndicator.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapePidIndicator.prototype.background = function(c, x, y, w, h)
{
	var type = mxUtils.getValue(this.style, mxShapePidIndicator.prototype.cst.IND_TYPE, 'inst');
	
	c.begin();
	c.moveTo(w * 0.5, w);
	c.lineTo(w * 0.5, h);
	c.stroke();

	if (type === mxShapePidIndicator.prototype.cst.INSTRUMENT)
	{
		c.ellipse(0, 0, w, w);
		c.fillAndStroke();
	}
	else if (type === mxShapePidIndicator.prototype.cst.CONTROL)
	{
		c.rect(0, 0, w, w);
		c.fillAndStroke();
	}
	else if (type === mxShapePidIndicator.prototype.cst.FUNCTION)
	{
		c.begin();
		c.moveTo(0, w * 0.5);
		c.lineTo(w * 0.25, 0);
		c.lineTo(w * 0.75, 0);
		c.lineTo(w, w * 0.5);
		c.lineTo(w * 0.75, w);
		c.lineTo(w * 0.25, w);
		c.close();
		c.fillAndStroke();
	}
	else if (type === mxShapePidIndicator.prototype.cst.PLC)
	{
		c.rect(0, 0, w, w);
		c.fillAndStroke();
	}
};

mxShapePidIndicator.prototype.foreground = function(c, x, y, w, h)
{
	var mounting = mxUtils.getValue(this.style, mxShapePidIndicator.prototype.cst.MOUNTING, 'field');
	var type = mxUtils.getValue(this.style, mxShapePidIndicator.prototype.cst.IND_TYPE, 'inst');

	if (type === mxShapePidIndicator.prototype.cst.CONTROL)
	{
		c.ellipse(0, 0, w, w);
		c.stroke();
	}
	else if (type === mxShapePidIndicator.prototype.cst.PLC)
	{
		c.begin();
		c.moveTo(0, w * 0.5);
		c.lineTo(w * 0.5, 0);
		c.lineTo(w, w * 0.5);
		c.lineTo(w * 0.5, w);
		c.close();
		c.stroke();
	}

	if (mounting === mxShapePidIndicator.prototype.cst.ROOM)
	{
		c.begin();
		c.moveTo(0, w * 0.5);
		c.lineTo(w, w * 0.5);
		c.stroke();
	}
	else if (mounting === mxShapePidIndicator.prototype.cst.INACCESSIBLE)
	{
		c.setDashed(true);
		c.begin();
		c.moveTo(0, w * 0.5);
		c.lineTo(w, w * 0.5);
		c.stroke();
	}
	else if (mounting === mxShapePidIndicator.prototype.cst.LOCAL)
	{
		c.begin();
		c.moveTo(w * 0.005, w * 0.48);
		c.lineTo(w * 0.995, w * 0.48);
		c.moveTo(w * 0.005, w * 0.52);
		c.lineTo(w * 0.995, w * 0.52);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapePidIndicator.prototype.cst.SHAPE_INDICATOR, mxShapePidIndicator);

mxShapePidIndicator.prototype.constraints = [new mxConnectionConstraint(new mxPoint(0.5, 1), true)];

//**********************************************************************************************************************************************************
//Logic
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapePidLogic(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapePidLogic, mxShape);

mxShapePidLogic.prototype.cst = {
		SHAPE_LOGIC : 'mxgraph.pid2inst.logic',
		MOUNTING : 'mounting',
		FIELD : 'field',
		ROOM : 'room',
		INACCESSIBLE : 'inaccessible',
		LOCAL : 'local'
};

mxShapePidLogic.prototype.customProperties = [
	{name: 'mounting', dispName: 'Mounting', type: 'enum', defVal:'field',
		enumList: [
			{val:'field', dispName:'Field'},
			{val:'room', dispName:'Room'},
			{val:'inaccessible', dispName:'Inaccessible'},
			{val:'local', dispName:'Local'}
	]}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapePidLogic.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapePidLogic.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapePidLogic.prototype.foreground = function(c, x, y, w, h)
{
	var mounting = mxUtils.getValue(this.style, mxShapePidLogic.prototype.cst.MOUNTING, 'field');

	if (mounting === mxShapePidLogic.prototype.cst.ROOM)
	{
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
	else if (mounting === mxShapePidLogic.prototype.cst.INACCESSIBLE)
	{
		c.setDashed(true);
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
	else if (mounting === mxShapePidLogic.prototype.cst.LOCAL)
	{
		c.begin();
		c.moveTo(w * 0.02, h * 0.48);
		c.lineTo(w * 0.98, h * 0.48);
		c.moveTo(w * 0.02, h * 0.52);
		c.lineTo(w * 0.98, h * 0.52);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapePidLogic.prototype.cst.SHAPE_LOGIC, mxShapePidLogic);

mxShapePidLogic.prototype.constraints = [
                                            new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                            new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                            new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                            new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                            new mxConnectionConstraint(new mxPoint(0.25, 0.25), false),
                                            new mxConnectionConstraint(new mxPoint(0.25, 0.75), false),
                                            new mxConnectionConstraint(new mxPoint(0.75, 0.25), false),
                                            new mxConnectionConstraint(new mxPoint(0.75, 0.75), false)
                                            ];
