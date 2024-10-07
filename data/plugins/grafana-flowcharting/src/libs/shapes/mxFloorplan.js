/**
 * $Id: mxFloorplan.js,v 1.3 2014/02/17 17:05:39 mate Exp $
 * Copyright (c) 2006-2014, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Wall
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxFloorplanWall(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxFloorplanWall, mxShape);

mxFloorplanWall.prototype.cst = {
		WALL : 'mxgraph.floorplan.wall',
		WALL_THICKNESS : "wallThickness"
};

mxFloorplanWall.prototype.customProperties = [
	{name:'wallThickness', dispName:'Thickness', type:'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxFloorplanWall.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxFloorplanWall.prototype.background = function(c, x, y, w, h)
{
	var wallTh = parseFloat(mxUtils.getValue(this.style, mxFloorplanWall.prototype.cst.WALL_THICKNESS, '10'));
	c.rect(0, h * 0.5 - wallTh * 0.5, w, wallTh);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxFloorplanWall.prototype.cst.WALL, mxFloorplanWall);

//**********************************************************************************************************************************************************
//Wall Corner
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxFloorplanWallCorner(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxFloorplanWallCorner, mxShape);

mxFloorplanWallCorner.prototype.cst = {
		WALL_CORNER : 'mxgraph.floorplan.wallCorner',
		WALL_THICKNESS : "wallThickness"
};

mxFloorplanWallCorner.prototype.customProperties = [
	{name:'wallThickness', dispName:'Thickness', type:'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxFloorplanWallCorner.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxFloorplanWallCorner.prototype.background = function(c, x, y, w, h)
{
	var wallTh = parseFloat(mxUtils.getValue(this.style, mxFloorplanWallCorner.prototype.cst.WALL_THICKNESS, '10'));

	c.begin();
	c.moveTo(0, h);
	c.lineTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, wallTh);
	c.lineTo(wallTh, wallTh);
	c.lineTo(wallTh, h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxFloorplanWallCorner.prototype.cst.WALL_CORNER, mxFloorplanWallCorner);

//**********************************************************************************************************************************************************
//Wall U
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxFloorplanWallU(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxFloorplanWallU, mxShape);

mxFloorplanWallU.prototype.cst = {
		WALL_U : 'mxgraph.floorplan.wallU',
		WALL_THICKNESS : "wallThickness"
};

mxFloorplanWallU.prototype.customProperties = [
	{name:'wallThickness', dispName:'Thickness', type:'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxFloorplanWallU.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxFloorplanWallU.prototype.background = function(c, x, y, w, h)
{
	var wallTh = parseFloat(mxUtils.getValue(this.style, mxFloorplanWallU.prototype.cst.WALL_THICKNESS, '10'));

	c.begin();
	c.moveTo(0, h);
	c.lineTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h);
	c.lineTo(w - wallTh, h);
	c.lineTo(w - wallTh, wallTh);
	c.lineTo(wallTh, wallTh);
	c.lineTo(wallTh, h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxFloorplanWallU.prototype.cst.WALL_U, mxFloorplanWallU);

//**********************************************************************************************************************************************************
//Room
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxFloorplanRoom(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxFloorplanRoom, mxShape);

mxFloorplanRoom.prototype.cst = {
		ROOM : 'mxgraph.floorplan.room',
		WALL_THICKNESS : "wallThickness"
};

mxFloorplanRoom.prototype.customProperties = [
	{name:'wallThickness', dispName:'Thickness', type:'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxFloorplanRoom.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxFloorplanRoom.prototype.background = function(c, x, y, w, h)
{
	var wallTh = parseFloat(mxUtils.getValue(this.style, mxFloorplanRoom.prototype.cst.WALL_THICKNESS, '10'));

	c.begin();
	c.moveTo(0, h);
	c.lineTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h);
	c.close();
	c.moveTo(wallTh, wallTh);
	c.lineTo(wallTh, h - wallTh);
	c.lineTo(w - wallTh, h - wallTh);
	c.lineTo(w - wallTh, wallTh);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxFloorplanRoom.prototype.cst.ROOM, mxFloorplanRoom);

//**********************************************************************************************************************************************************
//Window
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxFloorplanWindow(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxFloorplanWindow, mxShape);

mxFloorplanWindow.prototype.cst = {
		WINDOW : 'mxgraph.floorplan.window',
		WALL_THICKNESS : "wallThickness"
};

mxFloorplanWindow.prototype.customProperties = [
	{name:'wallThickness', dispName:'Thickness', type:'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxFloorplanWindow.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxFloorplanWindow.prototype.background = function(c, x, y, w, h)
{
	var wallTh = parseFloat(mxUtils.getValue(this.style, mxFloorplanWindow.prototype.cst.WALL_THICKNESS, '10'));
	c.rect(0, h * 0.5 - wallTh * 0.5, w, wallTh);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.stroke();
};

mxCellRenderer.registerShape(mxFloorplanWindow.prototype.cst.WINDOW, mxFloorplanWindow);

//**********************************************************************************************************************************************************
//Dimension
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxFloorplanDimension(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxFloorplanDimension, mxShape);

mxFloorplanDimension.prototype.cst = {
		DIMENSION : 'mxgraph.floorplan.dimension'
};

mxFloorplanDimension.prototype.customProperties = [
	{name:'wallThickness', dispName:'Thickness', type:'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxFloorplanDimension.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxFloorplanDimension.prototype.background = function(c, x, y, w, h)
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

mxCellRenderer.registerShape(mxFloorplanDimension.prototype.cst.DIMENSION, mxFloorplanDimension);

//**********************************************************************************************************************************************************
//Dimension Bottom
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxFloorplanDimensionBottom(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxFloorplanDimensionBottom, mxShape);

mxFloorplanDimensionBottom.prototype.cst = {
		DIMENSION : 'mxgraph.floorplan.dimensionBottom'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxFloorplanDimensionBottom.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxFloorplanDimensionBottom.prototype.background = function(c, x, y, w, h)
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

mxCellRenderer.registerShape(mxFloorplanDimensionBottom.prototype.cst.DIMENSION, mxFloorplanDimensionBottom);

//**********************************************************************************************************************************************************
//Stairs
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxFloorplanStairs(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxFloorplanStairs, mxShape);

mxFloorplanStairs.prototype.cst = {
		STAIRS : 'mxgraph.floorplan.stairs'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxFloorplanStairs.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var minW = Math.max(w, 50);
	this.background(c, x, y, minW, h);
};

mxFloorplanStairs.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
	
	var step = 25;
	c.setShadow(false);
	
	c.begin();
	
	for (var i = 25; i < w; i = i + step)
	{
		c.moveTo(i, 0);
		c.lineTo(i, h);
	}
	
	c.stroke();
	
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.moveTo(w - step, 0);
	c.lineTo(w, h * 0.5);
	c.lineTo(w - step, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxFloorplanStairs.prototype.cst.STAIRS, mxFloorplanStairs);

////**********************************************************************************************************************************************************
////Stairs Double
////**********************************************************************************************************************************************************
///**
//* Extends mxShape.
//*/
//function mxFloorplanStairsRest(bounds, fill, stroke, strokewidth)
//{
//	mxShape.call(this);
//	this.bounds = bounds;
//	this.fill = fill;
//	this.stroke = stroke;
//	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
//};
//
///**
//* Extends mxShape.
//*/
//mxUtils.extend(mxFloorplanStairsRest, mxShape);
//
//mxFloorplanStairsRest.prototype.cst = {
//		STAIRS : 'mxgraph.floorplan.stairsRest'
//};
//
//
//
///**
//* Function: paintVertexShape
//* 
//* Paints the vertex shape.
//*/
//mxFloorplanStairsRest.prototype.paintVertexShape = function(c, x, y, w, h)
//{
//	c.translate(x, y);
//	var minW = Math.max(w, 50, h);
//	var minH = Math.min(w, h);
//	this.background(c, x, y, minW, h);
//};
//
//mxFloorplanStairsRest.prototype.background = function(c, x, y, w, h)
//{
//	c.rect(0, 0, w, h);
//	c.fillAndStroke();
//	
//	var step = 25;
//	c.setShadow(false);
//	
//	c.begin();
//	
//	for (var i = 25; i < w - h * 0.5; i = i + step)
//	{
//		c.moveTo(i, 0);
//		c.lineTo(i, h);
//	}
//	
//	c.stroke();
//	
//	c.begin();
//	c.moveTo(0, h * 0.5);
//	c.lineTo(w, h * 0.5);
//	
//	c.moveTo(w, 0);
//	c.lineTo(w - h * 0.5, h * 0.5);
//	c.lineTo(w, h);
//	
//	c.moveTo(w - h * 0.5, 0);
//	c.lineTo(w - h * 0.5, h);
//	
//	c.moveTo(0, h * 0.5);
//	c.lineTo(w, h * 0.5);
//	c.stroke();
//};
//
//mxCellRenderer.registerShape(mxFloorplanStairsRest.prototype.cst.STAIRS, mxFloorplanStairsRest);

//**********************************************************************************************************************************************************
//Stairs
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxFloorplanStairsRest(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxFloorplanStairsRest, mxShape);

mxFloorplanStairsRest.prototype.cst = {
		STAIRS : 'mxgraph.floorplan.stairsRest'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxFloorplanStairsRest.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var minW = Math.max(w, 50, h);
	var minH = Math.min(w, h);
	this.background(c, x, y, minW, h);
};

mxFloorplanStairsRest.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
	
	var step = 25;
	c.setShadow(false);
	
	c.begin();
	
	for (var i = 25; i < w - h * 0.5; i = i + step)
	{
		c.moveTo(i, 0);
		c.lineTo(i, h);
	}
	
	c.stroke();
	
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	
	c.moveTo(w, 0);
	c.lineTo(w - h * 0.5, h * 0.5);
	c.lineTo(w, h);
	
	c.moveTo(w - h * 0.5, 0);
	c.lineTo(w - h * 0.5, h);
	
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.stroke();
};

mxCellRenderer.registerShape(mxFloorplanStairsRest.prototype.cst.STAIRS, mxFloorplanStairsRest);

//**********************************************************************************************************************************************************
//Door, Left
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxFloorplanDoorLeft(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxFloorplanDoorLeft, mxShape);

mxFloorplanDoorLeft.prototype.cst = {
		DOOR_LEFT : 'mxgraph.floorplan.doorLeft'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxFloorplanDoorLeft.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxFloorplanDoorLeft.prototype.background = function(c, x, y, w, h)
{
		c.rect(0, 0, w, 5);
		c.fillAndStroke();
		
		c.begin();
		c.moveTo(w, 5);
		c.arcTo(w, w, 0, 0, 1, 0, 5 + w);
		c.lineTo(0, 5);
		c.stroke();
};

mxCellRenderer.registerShape(mxFloorplanDoorLeft.prototype.cst.DOOR_LEFT, mxFloorplanDoorLeft);

//**********************************************************************************************************************************************************
//Door, Right
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxFloorplanDoorRight(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxFloorplanDoorRight, mxShape);

mxFloorplanDoorRight.prototype.cst = {
		DOOR_RIGHT : 'mxgraph.floorplan.doorRight'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxFloorplanDoorRight.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxFloorplanDoorRight.prototype.background = function(c, x, y, w, h)
{
		c.rect(0, 0, w, 5);
		c.fillAndStroke();
		
		c.begin();
		c.moveTo(0, 5);
		c.arcTo(w, w, 0, 0, 0, w, 5 + w);
		c.lineTo(w, 5);
		c.stroke();
};

mxCellRenderer.registerShape(mxFloorplanDoorRight.prototype.cst.DOOR_RIGHT, mxFloorplanDoorRight);

//**********************************************************************************************************************************************************
//Door, Double
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxFloorplanDoorDouble(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxFloorplanDoorDouble, mxShape);

mxFloorplanDoorDouble.prototype.cst = {
		DOOR_DOUBLE : 'mxgraph.floorplan.doorDouble'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxFloorplanDoorDouble.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxFloorplanDoorDouble.prototype.background = function(c, x, y, w, h)
{
	var halfW = w * 0.5; 
	c.rect(0, 0, w, 5);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(halfW, 0);
	c.lineTo(halfW, 5);
	c.moveTo(halfW, 5);
	c.arcTo(halfW, halfW, 0, 0, 1, 0, 5 + halfW);
	c.lineTo(0, 5);
	c.moveTo(halfW, 5);
	c.arcTo(halfW, halfW, 0, 0, 0, w, 5 + halfW);
	c.lineTo(w, 5);
	c.stroke();
};

mxCellRenderer.registerShape(mxFloorplanDoorDouble.prototype.cst.DOOR_DOUBLE, mxFloorplanDoorDouble);
