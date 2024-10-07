/**
 * $Id: mxEip.js,v 1.0 2014/11/27 06:09:21 mate Exp $
 * Copyright (c) 2006-2015, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Message Expiration
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeEipMessageExpiration(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeEipMessageExpiration, mxShape);

mxShapeEipMessageExpiration.prototype.cst = {
		SHAPE_MESS_EXP : 'mxgraph.eip.messExp'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeEipMessageExpiration.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxShapeEipMessageExpiration.prototype.background = function(c, x, y, w, h)
{
	c.ellipse(0, 0, w, h);
	c.stroke();
	
	c.setStrokeColor("#808080");
	c.begin();
	c.moveTo(w * 0.5, h * 0.1);
	c.lineTo(w * 0.5, h * 0.5);
	c.lineTo(w * 0.6, h * 0.8);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeEipMessageExpiration.prototype.cst.SHAPE_MESS_EXP, mxShapeEipMessageExpiration);

mxShapeEipMessageExpiration.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0.145, 0.145), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.855, 0.145), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.855, 0.855), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.145, 0.855), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Return Address
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeEipReturnAddress(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeEipReturnAddress, mxShape);

mxShapeEipReturnAddress.prototype.cst = {
		SHAPE_RET_ADDR : 'mxgraph.eip.retAddr'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeEipReturnAddress.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeEipReturnAddress.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeEipReturnAddress.prototype.foreground = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w * 0.05, h * 0.11);
	c.lineTo(w * 0.25, h * 0.11);
	c.moveTo(w * 0.05, h * 0.18);
	c.lineTo(w * 0.25, h * 0.18);
	c.moveTo(w * 0.05, h * 0.25);
	c.lineTo(w * 0.25, h * 0.25);

	c.setStrokeWidth(2);
	c.moveTo(w * 0.3, h * 0.63);
	c.lineTo(w * 0.8, h * 0.63);
	c.moveTo(w * 0.3, h * 0.72);
	c.lineTo(w * 0.8, h * 0.72);
	c.moveTo(w * 0.3, h * 0.80);
	c.lineTo(w * 0.8, h * 0.80);
	c.stroke();

	c.setFillColor("#EDEDED");
	c.rect(w * 0.8, h * 0.1, w * 0.12, h * 0.19);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeEipReturnAddress.prototype.cst.SHAPE_RET_ADDR, mxShapeEipReturnAddress);

mxShapeEipReturnAddress.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Anchor
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeEipAnchor(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeEipAnchor, mxShape);

mxShapeEipAnchor.prototype.cst = {
		SHAPE_ANCHOR : 'mxgraph.eip.anchor'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeEipAnchor.prototype.paintVertexShape = function(c, x, y, w, h)
{
};

mxCellRenderer.registerShape(mxShapeEipAnchor.prototype.cst.SHAPE_ANCHOR, mxShapeEipAnchor);

//**********************************************************************************************************************************************************
//Message Channel
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeEipMessageChannel(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeEipMessageChannel, mxShape);

mxShapeEipMessageChannel.prototype.cst = {
		SHAPE_MESSAGE_CHANNEL : 'mxgraph.eip.messageChannel'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeEipMessageChannel.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeEipMessageChannel.prototype.background = function(c, x, y, w, h)
{
	c.setGradient('#e6e6e6', '#808080', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.begin();
	c.moveTo(8, h * 0.5 + 10);
	c.arcTo(12, 12, 0, 0, 1, 8, h * 0.5 - 10);
	c.lineTo(w - 8, h * 0.5 - 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 + 10);
	c.close();
	c.fillAndStroke();
};

mxShapeEipMessageChannel.prototype.foreground = function(c, x, y, w, h)
{
	c.setFillColor('#e6e6e6');
	c.begin();
	c.moveTo(w - 8, h * 0.5 - 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 + 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 - 10);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeEipMessageChannel.prototype.cst.SHAPE_MESSAGE_CHANNEL, mxShapeEipMessageChannel);


mxShapeEipMessageChannel.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false, null, 2.7, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false, null, -2.7, 0));

	var currW = 10;
	
	while (currW < w)
	{
		constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, currW, 0));
		constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false, null, currW, 0));
		
		currW = currW + 10;
	}
	
	return (constr);
};

//**********************************************************************************************************************************************************
//Datatype Channel
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeEipDatatypeChannel(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeEipDatatypeChannel, mxShape);

mxShapeEipDatatypeChannel.prototype.cst = {
		SHAPE_DATATYPE_CHANNEL : 'mxgraph.eip.dataChannel'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeEipDatatypeChannel.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeEipDatatypeChannel.prototype.background = function(c, x, y, w, h)
{
	c.setGradient('#e6e6e6', '#808080', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.begin();
	c.moveTo(8, h * 0.5 + 10);
	c.arcTo(12, 12, 0, 0, 1, 8, h * 0.5 - 10);
	c.lineTo(w - 8, h * 0.5 - 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 + 10);
	c.close();
	c.fillAndStroke();
};

mxShapeEipDatatypeChannel.prototype.foreground = function(c, x, y, w, h)
{
	c.setFillColor('#e6e6e6');
	c.begin();
	c.moveTo(w - 8, h * 0.5 - 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 + 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 - 10);
	c.fillAndStroke();
	
	c.setFillColor("#fffbc0");
	c.setStrokeWidth("1");
	
	for(var i = 1; i * 20 + 10 < w - 14; i++)
	{
		c.rect(i * 20, h * 0.5 - 5, 10, 10);
		c.fillAndStroke();
	};
};

mxCellRenderer.registerShape(mxShapeEipDatatypeChannel.prototype.cst.SHAPE_DATATYPE_CHANNEL, mxShapeEipDatatypeChannel);

mxShapeEipDatatypeChannel.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false, null, 2.7, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false, null, -2.7, 0));

	var currW = 10;
	
	while (currW < w)
	{
		constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, currW, 0));
		constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false, null, currW, 0));
		
		currW = currW + 10;
	}
	
	return (constr);
};

//**********************************************************************************************************************************************************
//Dead Letter Channel
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeEipDeadLetterChannel(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeEipDeadLetterChannel, mxShape);

mxShapeEipDeadLetterChannel.prototype.cst = {
		SHAPE_DEAD_LETTER_CHANNEL : 'mxgraph.eip.deadLetterChannel'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeEipDeadLetterChannel.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeEipDeadLetterChannel.prototype.background = function(c, x, y, w, h)
{
	c.setGradient('#e6e6e6', '#808080', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.begin();
	c.moveTo(8, h * 0.5 + 10);
	c.arcTo(12, 12, 0, 0, 1, 8, h * 0.5 - 10);
	c.lineTo(w - 8, h * 0.5 - 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 + 10);
	c.close();
	c.fillAndStroke();
};

mxShapeEipDeadLetterChannel.prototype.foreground = function(c, x, y, w, h)
{
	c.setFillColor('#e6e6e6');
	c.begin();
	c.moveTo(w - 8, h * 0.5 - 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 + 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 - 10);
	c.fillAndStroke();
	
	c.setFillColor("#ff0000");
	c.setStrokeWidth("1");
	c.begin();
	c.moveTo(w * 0.5 - 6, h * 0.5 - 3);
	c.lineTo(w * 0.5 - 3, h * 0.5 - 6);
	c.lineTo(w * 0.5 + 3, h * 0.5 - 6);
	c.lineTo(w * 0.5 + 6, h * 0.5 - 3);
	c.lineTo(w * 0.5 + 6, h * 0.5 + 3);
	c.lineTo(w * 0.5 + 3, h * 0.5 + 6);
	c.lineTo(w * 0.5 - 3, h * 0.5 + 6);
	c.lineTo(w * 0.5 - 6, h * 0.5 + 3);
	c.close();
	c.fillAndStroke();
	
	c.setStrokeWidth("2");
	c.setStrokeColor("#ffffff");
	c.begin();
	c.moveTo(w * 0.5 - 4, h * 0.5);
	c.lineTo(w * 0.5 + 4, h * 0.5);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeEipDeadLetterChannel.prototype.cst.SHAPE_DEAD_LETTER_CHANNEL, mxShapeEipDeadLetterChannel);

mxShapeEipDeadLetterChannel.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false, null, 2.7, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false, null, -2.7, 0));

	var currW = 10;
	
	while (currW < w)
	{
		constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, currW, 0));
		constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false, null, currW, 0));
		
		currW = currW + 10;
	}
	
	return (constr);
};

//**********************************************************************************************************************************************************
//Invalid Message Channel
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeEipInvalidMessageChannel(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeEipInvalidMessageChannel, mxShape);

mxShapeEipInvalidMessageChannel.prototype.cst = {
		SHAPE_INVALID_MESSAGE_CHANNEL : 'mxgraph.eip.invalidMessageChannel'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeEipInvalidMessageChannel.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeEipInvalidMessageChannel.prototype.background = function(c, x, y, w, h)
{
	c.setGradient('#e6e6e6', '#808080', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.begin();
	c.moveTo(8, h * 0.5 + 10);
	c.arcTo(12, 12, 0, 0, 1, 8, h * 0.5 - 10);
	c.lineTo(w - 8, h * 0.5 - 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 + 10);
	c.close();
	c.fillAndStroke();
};

mxShapeEipInvalidMessageChannel.prototype.foreground = function(c, x, y, w, h)
{
	c.setFillColor('#e6e6e6');
	c.begin();
	c.moveTo(w - 8, h * 0.5 - 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 + 10);
	c.arcTo(12, 12, 0, 0, 1, w - 8, h * 0.5 - 10);
	c.fillAndStroke();
	
	c.setFillColor("#ffe040");
	c.setStrokeWidth("1");
	c.begin();
	c.moveTo(w * 0.5 - 6, h * 0.5 + 5);
	c.lineTo(w * 0.5, h * 0.5 - 5);
	c.lineTo(w * 0.5 + 6, h * 0.5 + 5);
	c.close();
	c.fillAndStroke();
	
	c.setStrokeWidth("1");
	c.begin();
	c.moveTo(w * 0.5, h * 0.5 - 2);
	c.lineTo(w * 0.5, h * 0.5 + 2);
	c.moveTo(w * 0.5, h * 0.5 + 3);
	c.lineTo(w * 0.5, h * 0.5 + 4);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeEipInvalidMessageChannel.prototype.cst.SHAPE_INVALID_MESSAGE_CHANNEL, mxShapeEipInvalidMessageChannel);

mxShapeEipInvalidMessageChannel.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false, null, 2.7, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false, null, -2.7, 0));

	var currW = 10;
	
	while (currW < w)
	{
		constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, currW, 0));
		constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false, null, currW, 0));
		
		currW = currW + 10;
	}
	
	return (constr);
};
