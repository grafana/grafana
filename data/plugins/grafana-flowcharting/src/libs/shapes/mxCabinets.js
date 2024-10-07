/**
 * $Id: mxCabinets.js,v 1.0 2014/04/15 07:05:39 mate Exp $
 * Copyright (c) 2006-2014, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Cabinet
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxCabinetsCabinet(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxCabinetsCabinet, mxShape);

mxCabinetsCabinet.prototype.cst = {
		HAS_STAND : 'hasStand',
		CABINET : 'mxgraph.cabinets.cabinet'
};

mxCabinetsCabinet.prototype.customProperties = [
	{name: 'hasStand', dispName:'Has Stand', type:'bool', defVal:true}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxCabinetsCabinet.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h);
};

mxCabinetsCabinet.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxCabinetsCabinet.prototype.foreground = function(c, x, y, w, h)
{
	var wallTh = 15;
	c.rect(0, 0, w, wallTh);
	c.stroke();
	
	c.begin();
	c.moveTo(wallTh, wallTh);
	c.lineTo(wallTh, h);
	c.moveTo(w - wallTh, wallTh);
	c.lineTo(w - wallTh, h);
	c.stroke();
	
	var hasStand = mxUtils.getValue(this.style, mxCabinetsCabinet.prototype.cst.HAS_STAND, '1');
	
	if (hasStand === 1)
	{
		c.rect(0, h - 40, w, 40);
		c.fillAndStroke();
	}
	else
	{
		c.rect(0, h - wallTh, w, wallTh);
		c.fillAndStroke();
	};
};

mxCellRenderer.registerShape(mxCabinetsCabinet.prototype.cst.CABINET, mxCabinetsCabinet);

//**********************************************************************************************************************************************************
//Cover Plate
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxCabinetsCoverPlate(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxCabinetsCoverPlate, mxShape);

mxCabinetsCoverPlate.prototype.cst = {
		COVER_PLATE : 'mxgraph.cabinets.coverPlate'
};



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxCabinetsCoverPlate.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h);
};

mxCabinetsCoverPlate.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h);
	c.lineTo(0, h);
	c.close();
	c.moveTo(10, h * 0.5 - 12.5);
	c.lineTo(10, h * 0.5 + 12.5);
	c.lineTo(w - 10, h * 0.5 + 12.5);
	c.lineTo(w - 10, h * 0.5 - 12.5);
	c.close();
	c.fillAndStroke();
};

mxCabinetsCoverPlate.prototype.foreground = function(c, x, y, w, h)
{
};

mxCellRenderer.registerShape(mxCabinetsCoverPlate.prototype.cst.COVER_PLATE, mxCabinetsCoverPlate);

//**********************************************************************************************************************************************************
//Dimension
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxCabinetsDimension(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxCabinetsDimension, mxShape);

mxCabinetsDimension.prototype.cst = {
		DIMENSION : 'mxgraph.cabinets.dimension'
};



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxCabinetsDimension.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxCabinetsDimension.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, 20);
	c.lineTo(w, 20);
	c.moveTo(10, 15);
	c.lineTo(0, 20);
	c.lineTo(10, 25);
	c.moveTo(w - 10, 15);
	c.lineTo(w, 20);
	c.lineTo(w - 10, 25);
	c.moveTo(0, 15);
	c.lineTo(0, h);
	c.moveTo(w, 15);
	c.lineTo(w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxCabinetsDimension.prototype.cst.DIMENSION, mxCabinetsDimension);

//**********************************************************************************************************************************************************
//Dimension Bottom
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxCabinetsDimensionBottom(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxCabinetsDimensionBottom, mxShape);

mxCabinetsDimensionBottom.prototype.cst = {
		DIMENSION : 'mxgraph.cabinets.dimensionBottom'
};



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxCabinetsDimensionBottom.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxCabinetsDimensionBottom.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, h - 20);
	c.lineTo(w, h - 20);
	c.moveTo(10, h - 15);
	c.lineTo(0, h - 20);
	c.lineTo(10, h - 25);
	c.moveTo(w - 10, h - 15);
	c.lineTo(w, h - 20);
	c.lineTo(w - 10, h - 25);
	c.moveTo(0, h - 15);
	c.lineTo(0, 0);
	c.moveTo(w, h - 15);
	c.lineTo(w, 0);
	c.stroke();
};

mxCellRenderer.registerShape(mxCabinetsDimensionBottom.prototype.cst.DIMENSION, mxCabinetsDimensionBottom);

