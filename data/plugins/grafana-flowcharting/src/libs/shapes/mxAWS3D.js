/**
 * $Id: mxAws3d.js,v 1.0 2015/10/11 07:05:39 mate Exp $
 * Copyright (c) 2006-2015, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Arrow NE
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dArrowNE(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dArrowNE, mxShape);

mxShapeAws3dArrowNE.prototype.cst = {
		ARROW_NE : 'mxgraph.aws3d.arrowNE'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dArrowNE.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(w - 17, 8);
	c.lineTo(w - 21, 5.5);
	c.lineTo(w, 0);
	c.lineTo(w - 9.7, 12.2);
	c.lineTo(w - 13.9, 9.8);
	c.lineTo(9.7, h - 3.5);
	c.arcTo(6, 3, 0, 0, 1, 9, h - 0.4);
	c.arcTo(5.2, 3, 0, 0, 1, 1, h - 1.4);
	c.arcTo(6, 2.8, 0, 0, 1, 3, h - 5.4);
	c.arcTo(5, 3, 0, 0, 1, 6.7, h - 5.2);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeAws3dArrowNE.prototype.cst.ARROW_NE, mxShapeAws3dArrowNE);

//**********************************************************************************************************************************************************
//Arrow SE
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dArrowSE(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dArrowSE, mxShape);

mxShapeAws3dArrowSE.prototype.cst = {
		ARROW_SE : 'mxgraph.aws3d.arrowSE'
};



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dArrowSE.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(w - 17, h - 8);
	c.lineTo(w - 21, h - 5.5);
	c.lineTo(w, h);
	c.lineTo(w - 9.7, h - 12.2);
	c.lineTo(w - 13.9, h - 9.8);
	c.lineTo(9.7, 3.5);
	c.arcTo(6, 3, 0, 0, 0, 9, 0.4);
	c.arcTo(5.2, 3, 0, 0, 0, 1, 1.4);
	c.arcTo(6, 2.8, 0, 0, 0, 3, 5.4);
	c.arcTo(5, 3, 0, 0, 0, 6.7, 5.2);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeAws3dArrowSE.prototype.cst.ARROW_SE, mxShapeAws3dArrowSE);

//**********************************************************************************************************************************************************
//Arrow SW
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dArrowSW(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dArrowSW, mxShape);

mxShapeAws3dArrowSW.prototype.cst = {
		ARROW_SW : 'mxgraph.aws3d.arrowSW'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dArrowSW.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(17, h - 8);
	c.lineTo(21, h - 5.5);
	c.lineTo(0, h);
	c.lineTo(9.7, h - 12.2);
	c.lineTo(13.9, h - 9.8);
	c.lineTo(w - 9.7, 3.5);
	c.arcTo(6, 3, 0, 0, 1, w - 9, 0.4);
	c.arcTo(5.2, 3, 0, 0, 1, w - 1, 1.4);
	c.arcTo(6, 2.8, 0, 0, 1, w - 3, 5.4);
	c.arcTo(5, 3, 0, 0, 1, w - 6.7, 5.2);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeAws3dArrowSW.prototype.cst.ARROW_SW, mxShapeAws3dArrowSW);

//**********************************************************************************************************************************************************
//Arrow NW
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dArrowNW(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dArrowNW, mxShape);

mxShapeAws3dArrowNW.prototype.cst = {
		ARROW_NW : 'mxgraph.aws3d.arrowNW'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dArrowNW.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(17, 8);
	c.lineTo(21, 5.5);
	c.lineTo(0, 0);
	c.lineTo(9.7, 12.2);
	c.lineTo(13.9, 9.8);
	c.lineTo(w - 9.7, h - 3.5);
	c.arcTo(6, 3, 0, 0, 0, w - 9, h - 0.4);
	c.arcTo(5.2, 3, 0, 0, 0, w - 1, h - 1.4);
	c.arcTo(6, 2.8, 0, 0, 0, w - 3, h - 5.4);
	c.arcTo(5, 3, 0, 0, 0, w - 6.7, h - 5.2);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeAws3dArrowNW.prototype.cst.ARROW_NW, mxShapeAws3dArrowNW);

//**********************************************************************************************************************************************************
//Arrowless NE
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dArrowlessNE(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dArrowlessNE, mxShape);

mxShapeAws3dArrowlessNE.prototype.cst = {
		ARROWLESS_NE : 'mxgraph.aws3d.arrowlessNE'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dArrowlessNE.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(w - 3.1, 0);
	c.lineTo(w, 1.8);
	c.lineTo(9.7, h - 3.5);
	c.arcTo(6, 3, 0, 0, 1, 9, h - 0.4);
	c.arcTo(5.2, 3, 0, 0, 1, 1, h - 1.4);
	c.arcTo(6, 2.8, 0, 0, 1, 3, h - 5.4);
	c.arcTo(5, 3, 0, 0, 1, 6.7, h - 5.2);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeAws3dArrowlessNE.prototype.cst.ARROWLESS_NE, mxShapeAws3dArrowlessNE);

//**********************************************************************************************************************************************************
//Dashed edge with double arrow
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dDashedEdgeDouble(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dDashedEdgeDouble, mxShape);

mxShapeAws3dDashedEdgeDouble.prototype.cst = {
		DASHED_EDGE_DOUBLE : 'mxgraph.aws3d.dashedEdgeDouble'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dDashedEdgeDouble.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.setFillColor('#2D6195');
	c.save();
	c.setStrokeColor('none');
	c.begin();
	c.moveTo(21, 5.5);
	c.lineTo(0, 0);
	c.lineTo(9.7, 12.2);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w - 21, h - 5.5);
	c.lineTo(w, h);
	c.lineTo(w - 9.7, h - 12.2);
	c.fillAndStroke();
	
	c.restore();
	c.setStrokeColor('#2D6195');
	c.setStrokeWidth('4');
	c.setDashed('true');
	c.setLineCap('round');
	
	c.begin();
	c.moveTo(7.675, 4.425);
	c.lineTo(w - 7.675, h - 4.425);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dDashedEdgeDouble.prototype.cst.DASHED_EDGE_DOUBLE, mxShapeAws3dDashedEdgeDouble);

//**********************************************************************************************************************************************************
//Dashed arrowless edge
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dDashedArrowlessEdge(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dDashedArrowlessEdge, mxShape);

mxShapeAws3dDashedArrowlessEdge.prototype.cst = {
		DASHED_ARROWLESS_EDGE : 'mxgraph.aws3d.dashedArrowlessEdge'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dDashedArrowlessEdge.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.setStrokeColor('#2D6195');
	c.setStrokeWidth('4');
	c.setDashed('true');
	c.setLineCap('round');
	
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dDashedArrowlessEdge.prototype.cst.DASHED_ARROWLESS_EDGE, mxShapeAws3dDashedArrowlessEdge);

//**********************************************************************************************************************************************************
//Dashed edge
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dDashedEdge(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dDashedEdge, mxShape);

mxShapeAws3dDashedEdge.prototype.cst = {
		DASHED_EDGE : 'mxgraph.aws3d.dashedEdge'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dDashedEdge.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.setFillColor('#2D6195');
	c.save();
	c.setStrokeColor('none');
	c.begin();
	c.moveTo(w - 21, 5.5);
	c.lineTo(w, 0);
	c.lineTo(w - 9.7, 12.2);
	c.fillAndStroke();
	
	c.restore();
	c.setStrokeColor('#2D6195');
	c.setStrokeWidth('4');
	c.setDashed('true');
	c.setLineCap('round');
	
	c.begin();
	c.moveTo(w - 7.675, 4.425);
	c.lineTo(0, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dDashedEdge.prototype.cst.DASHED_EDGE, mxShapeAws3dDashedEdge);

//**********************************************************************************************************************************************************
//Flat edge
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dFlatEdge(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dFlatEdge, mxShape);

mxShapeAws3dFlatEdge.prototype.cst = {
		FLAT_EDGE : 'mxgraph.aws3d.flatEdge'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dFlatEdge.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.setFillColor('#F4B934');
	c.setStrokeColor('none');
	c.begin();
	c.moveTo(w - 46, 8.8);
	c.lineTo(w - 61.2, 0);
	c.lineTo(w, 0);
	c.lineTo(w, 35.5);
	c.lineTo(w - 15.4, 26.5);
	c.lineTo(30.7, h);
	c.lineTo(0, h - 17.7);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeAws3dFlatEdge.prototype.cst.FLAT_EDGE, mxShapeAws3dFlatEdge);

//**********************************************************************************************************************************************************
//Flat double edge
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dFlatDoubleEdge(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dFlatDoubleEdge, mxShape);

mxShapeAws3dFlatDoubleEdge.prototype.cst = {
		FLAT_DOUBLE_EDGE : 'mxgraph.aws3d.flatDoubleEdge'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dFlatDoubleEdge.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.setFillColor('#F4B934');
	c.setStrokeColor('none');

	c.begin();
	c.moveTo(15.3, 61.9);
	c.lineTo(30.8, 53.2);
	c.lineTo(15.4, 44.2);
	c.lineTo(0, 53.2);
	c.lineTo(15.4, 8.8);
	c.lineTo(92.1, 0);
	c.lineTo(76.5, 8.8);
	c.lineTo(92.1, 17.7);
	c.lineTo(107.4, 8.8);
	
	c.lineTo(w - 15.3, h - 61.9);
	c.lineTo(w - 30.8, h - 53.2);
	c.lineTo(w - 15.4, h - 44.2);
	c.lineTo(w, h - 53.2);
	c.lineTo(w - 15.4, h - 8.8);
	c.lineTo(w - 92.1, h);
	c.lineTo(w - 76.5, h - 8.8);
	c.lineTo(w - 92.1, h - 17.7);
	c.lineTo(w - 107.4, h - 8.8);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeAws3dFlatDoubleEdge.prototype.cst.FLAT_DOUBLE_EDGE, mxShapeAws3dFlatDoubleEdge);

//**********************************************************************************************************************************************************
//AMI
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dAMI(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dAMI, mxShape);

mxShapeAws3dAMI.prototype.cst = {
		AMI : 'mxgraph.aws3d.ami',
		SHADING_COLORS : 'shadingCols' 
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dAMI.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	var strokeWidth1 = strokeWidth * w / 92;
	var strokeWidth2 = strokeWidth * h / 60;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	
	c.setStrokeWidth(strokeWidth);
	c.setShadow(false);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if (isShadow == 1)
	{
		c.setShadow(true);
	}

	c.begin();
	c.moveTo(0, h * 0.6483);
	c.lineTo(w * 0.0684, h * 0.4133);
	c.lineTo(w * 0.5326, 0);
	c.lineTo(w * 0.6685, 0);
	c.lineTo(w * 0.9359, h * 0.2367);
	c.lineTo(w, h * 0.465);
	c.lineTo(w * 0.4, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dAMI.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.65);
	c.lineTo(w * 0.0652, h * 0.5);
	c.lineTo(w * 0.3326, h * 0.7667);
	c.lineTo(w * 0.4663, h * 0.7667);
	c.lineTo(w * 0.4, h);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.4, h);
	c.lineTo(w * 0.4641, h * 0.77);
	c.lineTo(w * 0.9326, h * 0.355);
	c.lineTo(w * 0.9347, h * 0.24);
	c.lineTo(w, h * 0.4667);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.65);
	c.lineTo(w * 0.0652, h * 0.5);
	c.lineTo(w * 0.3326, h * 0.7667);
	c.lineTo(w * 0.4663, h * 0.7667);
	c.lineTo(w * 0.4, h);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.4, h);
	c.lineTo(w * 0.4641, h * 0.77);
	c.lineTo(w * 0.9326, h * 0.355);
	c.lineTo(w * 0.9347, h * 0.24);
	c.lineTo(w, h * 0.4667);
	c.close();
	c.stroke();
	
	c.begin();
	c.moveTo(w * 0.0652, h * 0.42);
	c.lineTo(w * 0.0652, h * 0.5);
	c.moveTo(w * 0.3337, h * 0.7667);
	c.lineTo(w * 0.4, h);
	c.moveTo(w * 0.9348, h * 0.355);
	c.lineTo(w, h * 0.4733);
	c.stroke();
	
	c.setLineJoin('miter');
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.1935, h * 0.42);
	c.lineTo(w * 0.5543, h * 0.0967);
	c.lineTo(w * 0.6652, h * 0.1967);
	c.lineTo(w * 0.3, h * 0.5133);
	c.close();
	c.moveTo(w * 0.2967, h * 0.4633);
	c.lineTo(w * 0.3837, h * 0.3883);
	c.lineTo(w * 0.3326, h * 0.3417);
	c.lineTo(w * 0.2467, h * 0.42);
	c.close();
	c.moveTo(w * 0.362, h * 0.32);
	c.lineTo(w * 0.412, h * 0.3633);
	c.lineTo(w * 0.5054, h * 0.2867);
	c.lineTo(w * 0.4522, h * 0.24);
	c.close();
	c.moveTo(w * 0.5293, h * 0.26);
	c.lineTo(w * 0.6109, h * 0.1933);
	c.lineTo(w * 0.5511, h * 0.145);
	c.lineTo(w * 0.4739, h * 0.2133);
	c.close();
	c.moveTo(w * 0.3528, h * 0.557);
	c.lineTo(w * 0.7137, h * 0.2337);
	c.lineTo(w * 0.8246, h * 0.3337);
	c.lineTo(w * 0.4593, h * 0.6503);
	c.close();
	c.moveTo(w * 0.4561, h * 0.6003);
	c.lineTo(w * 0.543, h * 0.5253);
	c.lineTo(w * 0.492, h * 0.4787);
	c.lineTo(w * 0.4061, h * 0.557);
	c.close();
	c.moveTo(w * 0.5213, h * 0.457);
	c.lineTo(w * 0.5713, h * 0.5003);
	c.lineTo(w * 0.6648, h * 0.4237);
	c.lineTo(w * 0.6115, h * 0.377);
	c.close();
	c.moveTo(w * 0.6887, h * 0.397);
	c.lineTo(w * 0.7702, h * 0.3303);
	c.lineTo(w * 0.7104, h * 0.282);
	c.lineTo(w * 0.6333, h * 0.3503);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.6483);
	c.lineTo(w * 0.0684, h * 0.4133);
	c.lineTo(w * 0.5326, 0);
	c.lineTo(w * 0.6685, 0);
	c.lineTo(w * 0.9359, h * 0.2367);
	c.lineTo(w, h * 0.465);
	c.lineTo(w * 0.4, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dAMI.prototype.cst.AMI, mxShapeAws3dAMI);

//**********************************************************************************************************************************************************
//Snapshot
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dSnapshot(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dSnapshot, mxShape);

mxShapeAws3dSnapshot.prototype.cst = {
		SNAPSHOT : 'mxgraph.aws3d.snapshot',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dSnapshot.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 92;
	var strokeWidth2 = strokeWidth * h / 60;
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	
	c.setStrokeWidth(strokeWidth);
	c.setShadow(false);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if(isShadow == 1)
	{
		c.setShadow(true);
	}
	
	c.begin();
	c.moveTo(w, h * 0.6483);
	c.lineTo(w * 0.9316, h * 0.4133);
	c.lineTo(w * 0.4674, 0);
	c.lineTo(w * 0.3315, 0);
	c.lineTo(w * 0.0641, h * 0.2367);
	c.lineTo(0, h * 0.465);
	c.lineTo(w * 0.6, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');

	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dSnapshot.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	
	c.begin();
	c.moveTo(w, h * 0.65);
	c.lineTo(w * 0.9348, h * 0.52);
	c.lineTo(w * 0.6674, h * 0.7667);
	c.lineTo(w * 0.5337, h * 0.7667);
	c.lineTo(w * 0.6, h);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	c.begin();
	c.moveTo(w * 0.6, h);
	c.lineTo(w * 0.5359, h * 0.77);
	c.lineTo(w * 0.0674, h * 0.355);
	c.lineTo(w * 0.0653, h * 0.24);
	c.lineTo(0, h * 0.4667);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(w, h * 0.65);
	c.lineTo(w * 0.9348, h * 0.52);
	c.lineTo(w * 0.6674, h * 0.7667);
	c.lineTo(w * 0.5337, h * 0.7667);
	c.lineTo(w * 0.6, h);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.6, h);
	c.lineTo(w * 0.5359, h * 0.77);
	c.lineTo(w * 0.0674, h * 0.355);
	c.lineTo(w * 0.0653, h * 0.24);
	c.lineTo(0, h * 0.4667);
	c.close();
	c.stroke();
	
	c.begin();
	c.moveTo(w * 0.9348, h * 0.42);
	c.lineTo(w * 0.9348, h * 0.52);
	c.moveTo(w * 0.6663, h * 0.7667);
	c.lineTo(w * 0.6, h);
	c.moveTo(w * 0.0652, h * 0.355);
	c.lineTo(0, h * 0.4733);
	c.stroke();
	
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(w, h * 0.6483);
	c.lineTo(w * 0.9316, h * 0.4133);
	c.lineTo(w * 0.4674, 0);
	c.lineTo(w * 0.3315, 0);
	c.lineTo(w * 0.0641, h * 0.2367);
	c.lineTo(0, h * 0.465);
	c.lineTo(w * 0.6, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dSnapshot.prototype.cst.SNAPSHOT, mxShapeAws3dSnapshot);

//**********************************************************************************************************************************************************
//Application
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dApplication(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dApplication, mxShape);

mxShapeAws3dApplication.prototype.cst = {
		APPLICATION : 'mxgraph.aws3d.application',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dApplication.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 62;
	var strokeWidth2 = strokeWidth * h / 68.8;
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	c.setShadow(false);
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if (isShadow == 1)
	{
		c.setShadow(true);
	}
	
	c.begin();
	c.moveTo(0, h * 0.2544);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.2544);
	c.lineTo(w, h * 0.7485);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7485);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dApplication.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.2544);
	c.lineTo(w * 0.5, h * 0.5015);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7485);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5, h * 0.5015);
	c.lineTo(w, h * 0.2544);
	c.lineTo(w, h * 0.7485);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.2544);
	c.lineTo(w * 0.5, h * 0.5015);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7485);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.5, h * 0.5015);
	c.lineTo(w, h * 0.2544);
	c.lineTo(w, h * 0.7485);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
	
	c.setLineJoin('miter');
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.6694, h * 0.0872);
	c.lineTo(w * 0.7629, h * 0.1337);
	c.lineTo(w * 0.2661, h * 0.3882);
	c.lineTo(w * 0.2661, h * 0.5407);
	c.lineTo(w * 0.1742, h * 0.4953);
	c.lineTo(w * 0.1742, h * 0.3459);
	c.close();
	c.moveTo(w * 0.8629, h * 0.1846);
	c.lineTo(w * 0.379, h * 0.4331);
	c.lineTo(w * 0.379, h * 0.5945);
	c.lineTo(w * 0.2855, h * 0.5494);
	c.lineTo(w * 0.2855, h * 0.3953);
	c.lineTo(w * 0.7839, h * 0.1439);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.2544);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.2544);
	c.lineTo(w, h * 0.7485);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7485);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dApplication.prototype.cst.APPLICATION, mxShapeAws3dApplication);

//**********************************************************************************************************************************************************
//Application Server
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dApplicationServer(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dApplicationServer, mxShape);

mxShapeAws3dApplicationServer.prototype.cst = {
		APPLICATION_SERVER : 'mxgraph.aws3d.application_server',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dApplicationServer.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h / 124;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dApplicationServer.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7236);
	c.lineTo(0, h * 0.2863);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.2863);
	c.lineTo(w, h * 0.7236);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dApplicationServer.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dApplicationServer.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.2863);
	c.lineTo(w * 0.5, h * 0.5726);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7177);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w, h * 0.2863);
	c.lineTo(w * 0.5, h * 0.5726);
	c.lineTo(w * 0.5, h);
	c.lineTo(w, h * 0.7177);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.2863);
	c.lineTo(w * 0.5, h * 0.5726);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7177);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w, h * 0.2863);
	c.lineTo(w * 0.5, h * 0.5726);
	c.lineTo(w * 0.5, h);
	c.lineTo(w, h * 0.7177);
	c.close();
	c.stroke();
	
	c.setLineJoin('miter');
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.374, h * 0.4435);
	c.arcTo(w * 0.0325, h * 0.0202, 0, 0, 1, w * 0.374, h * 0.4153);
	c.lineTo(w * 0.4797, h * 0.3548);
	c.arcTo(w * 0.0325, h * 0.0161, 0, 0, 1, w * 0.5203, h * 0.3548);
	c.lineTo(w * 0.626, h * 0.4153);
	c.arcTo(w * 0.0325, h * 0.0202, 0, 0, 1, w * 0.626, h * 0.4411);
	c.lineTo(w * 0.5203, h * 0.5016);
	c.arcTo(w * 0.0325, h * 0.0161, 0, 0, 1, w * 0.4797, h * 0.5016);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7236);
	c.lineTo(0, h * 0.2863);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.2863);
	c.lineTo(w, h * 0.7236);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dApplicationServer.prototype.cst.APPLICATION_SERVER, mxShapeAws3dApplicationServer);

//**********************************************************************************************************************************************************
//CloudFront
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dCloudFront(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dCloudFront, mxShape);

mxShapeAws3dCloudFront.prototype.cst = {
		CLOUDFRONT : 'mxgraph.aws3d.cloudfront',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dCloudFront.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 103.8;
	var strokeWidth2 = strokeWidth * h / 169.8;
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	c.setShadow(false);
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if (isShadow == 1)
	{
		c.setShadow(true);
	}
	
	c.begin();
	c.moveTo(0, h * 0.7915);
	c.lineTo(0, h * 0.7491);
	c.lineTo(w * 0.0588, h * 0.7279);
	c.lineTo(w * 0.0588, h * 0.1036);
	c.lineTo(w * 0.3526, 0);
	c.lineTo(w * 0.9422, h * 0.2073);
	c.lineTo(w * 0.9422, h * 0.8316);
	c.lineTo(w, h * 0.8539);
	c.lineTo(w, h * 0.894);
	c.lineTo(w * 0.7013, h);
	c.lineTo(w * 0.5877, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dCloudFront.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(w * 0.0588, h * 0.106);
	c.lineTo(w * 0.6474, h * 0.3121);
	c.lineTo(w * 0.6474, h * 0.9352);
	c.lineTo(w * 0.7052, h);
	c.lineTo(w * 0.5915, h);
	c.lineTo(0, h * 0.7915);
	c.lineTo(0, h * 0.7491);
	c.lineTo(w * 0.0588, h * 0.7279);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.6474, h * 0.3121);
	c.lineTo(w * 0.9422, h * 0.2073);
	c.lineTo(w * 0.9422, h * 0.8363);
	c.lineTo(w, h * 0.8539);
	c.lineTo(w, h * 0.894);
	c.lineTo(w * 0.7013, h);
	c.lineTo(w * 0.6474, h * 0.9305);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	c.begin();
	c.moveTo(0, h * 0.7915);
	c.lineTo(w * 0.0559, h * 0.7291);
	c.lineTo(w * 0.6474, h * 0.9364);
	c.lineTo(w * 0.5896, h);
	c.moveTo(w * 0.6493, h * 0.9364);
	c.lineTo(w * 0.9412, h * 0.8333);
	c.lineTo(w, h * 0.894);
	c.stroke();

	c.begin();
	c.moveTo(w * 0.0588, h * 0.106);
	c.lineTo(w * 0.6474, h * 0.3121);
	c.lineTo(w * 0.6474, h * 0.9352);
	c.lineTo(w * 0.7052, h);
	c.lineTo(w * 0.5915, h);
	c.lineTo(0, h * 0.7915);
	c.lineTo(0, h * 0.7491);
	c.lineTo(w * 0.0588, h * 0.7279);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.6474, h * 0.3121);
	c.lineTo(w * 0.9422, h * 0.2073);
	c.lineTo(w * 0.9422, h * 0.8363);
	c.lineTo(w, h * 0.8539);
	c.lineTo(w, h * 0.894);
	c.lineTo(w * 0.7013, h);
	c.lineTo(w * 0.6474, h * 0.9305);
	c.close();
	c.stroke();

	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	
	c.begin();
	c.moveTo(w * 0.3333, h * 0.6643);
	c.arcTo(w * 0.3372, h * 0.2061, 0, 0, 1, w * 0.2351, h * 0.6042);
	c.arcTo(w * 0.4528, h * 0.2768, 0, 0, 1, w * 0.1724, h * 0.523);
	c.lineTo(w * 0.2428, h * 0.5677);
	c.lineTo(w * 0.2427, h * 0.5895);
	c.lineTo(w * 0.2765, h * 0.5995);
	c.close();
	c.moveTo(w * 0.1599, h * 0.4935);
	c.arcTo(w * 0.3372, h * 0.2061, 0, 0, 1, w * 0.1522, h * 0.4146);
	c.arcTo(w * 0.1156, h * 0.0883, 0, 0, 1, w * 0.2071, h * 0.3486);
	c.lineTo(w * 0.2013, h * 0.4187);
	c.lineTo(w * 0.1859, h * 0.4146);
	c.lineTo(w * 0.1859, h * 0.4464);
	c.lineTo(w * 0.1907, h * 0.4493);
	c.close();
	c.moveTo(w * 0.2235, h * 0.3445);
	c.arcTo(w * 0.1927, h * 0.1767, 0, 0, 1, w * 0.368, h * 0.361);
	c.arcTo(w * 0.3854, h * 0.2356, 0, 0, 1, w * 0.468, h * 0.4299);
	c.lineTo(w * 0.368, h * 0.4034);
	c.lineTo(w * 0.368, h * 0.394);
	c.lineTo(w * 0.3256, h * 0.3799);
	c.lineTo(w * 0.3256, h * 0.3887);
	c.close();
	c.moveTo(w * 0.4855, h * 0.4499);
	c.arcTo(w * 0.3854, h * 0.2356, 0, 0, 1, w * 0.5337, h * 0.5395);
	c.arcTo(w * 0.3854, h * 0.2356, 0, 0, 1, w * 0.5328, h * 0.6302);
	c.lineTo(w * 0.4952, h * 0.5589);
	c.lineTo(w * 0.5019, h * 0.5595);
	c.lineTo(w * 0.5019, h * 0.5265);
	c.lineTo(w * 0.4855, h * 0.5194);
	c.close();
	c.moveTo(w * 0.5241, h * 0.6455);
	c.arcTo(w * 0.0963, h * 0.0589, 0, 0, 1, w * 0.4663, h * 0.682);
	c.arcTo(w * 0.1445, h * 0.0883, 0, 0, 1, w * 0.3642, h * 0.6761);
	c.lineTo(w * 0.4239, h * 0.6525);
	c.lineTo(w * 0.4566, h * 0.6643);
	c.lineTo(w * 0.4566, h * 0.6413);
	c.close();
	c.moveTo(w * 0.3507, h * 0.6667);
	c.lineTo(w * 0.2871, h * 0.5919);
	c.lineTo(w * 0.4123, h * 0.6366);
	c.close();
	c.moveTo(w * 0.2563, h * 0.5595);
	c.lineTo(w * 0.1753, h * 0.5088);
	c.lineTo(w * 0.2052, h * 0.4594);
	c.close();
	c.moveTo(w * 0.2139, h * 0.4229);
	c.lineTo(w * 0.2197, h * 0.3528);
	c.lineTo(w * 0.3256, h * 0.4028);
	c.lineTo(w * 0.2283, h * 0.4252);
	c.close();
	c.moveTo(w * 0.2264, h * 0.4417);
	c.lineTo(w * 0.3218, h * 0.4146);
	c.lineTo(w * 0.3353, h * 0.4181);
	c.lineTo(w * 0.3353, h * 0.4971);
	c.lineTo(w * 0.3208, h * 0.4912);
	c.lineTo(w * 0.3208, h * 0.4965);
	c.lineTo(w * 0.2264, h * 0.4482);
	c.close();
	c.moveTo(w * 0.2697, h * 0.5618);
	c.lineTo(w * 0.2245, h * 0.4635);
	c.lineTo(w * 0.2331, h * 0.4588);
	c.lineTo(w * 0.3256, h * 0.5112);
	c.lineTo(w * 0.3237, h * 0.5241);
	c.close();
	c.moveTo(w * 0.2852, h * 0.576);
	c.lineTo(w * 0.2852, h * 0.5654);
	c.lineTo(w * 0.3391, h * 0.53);
	c.lineTo(w * 0.3516, h * 0.5347);
	c.lineTo(w * 0.4133, h * 0.6213);
	c.close();
	c.moveTo(w * 0.368, h * 0.5141);
	c.lineTo(w * 0.368, h * 0.5088);
	c.lineTo(w * 0.3526, h * 0.5029);
	c.lineTo(w * 0.3526, h * 0.4234);
	c.lineTo(w * 0.3622, h * 0.4276);
	c.lineTo(w * 0.4547, h * 0.5177);
	c.lineTo(w * 0.4557, h * 0.5277);
	c.close();
	c.moveTo(w * 0.3671, h * 0.417);
	c.lineTo(w * 0.4692, h * 0.4411);
	c.lineTo(w * 0.4721, h * 0.52);
	c.close();
	c.moveTo(w * 0.368, h * 0.5253);
	c.lineTo(w * 0.4566, h * 0.5359);
	c.lineTo(w * 0.4566, h * 0.5453);
	c.lineTo(w * 0.4663, h * 0.5465);
	c.lineTo(w * 0.4335, h * 0.6201);
	c.lineTo(w * 0.422, h * 0.616);
	c.lineTo(w * 0.368, h * 0.5389);
	c.close();
	c.moveTo(w * 0.4798, h * 0.5583);
	c.lineTo(w * 0.5183, h * 0.629);
	c.lineTo(w * 0.4557, h * 0.6313);
	c.lineTo(w * 0.4557, h * 0.6237);
	c.lineTo(w * 0.447, h * 0.6225);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7915);
	c.lineTo(0, h * 0.7491);
	c.lineTo(w * 0.0588, h * 0.7279);
	c.lineTo(w * 0.0588, h * 0.1036);
	c.lineTo(w * 0.3526, 0);
	c.lineTo(w * 0.9422, h * 0.2073);
	c.lineTo(w * 0.9422, h * 0.8316);
	c.lineTo(w, h * 0.8539);
	c.lineTo(w, h * 0.894);
	c.lineTo(w * 0.7013, h);
	c.lineTo(w * 0.5877, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dCloudFront.prototype.cst.CLOUDFRONT, mxShapeAws3dCloudFront);

//**********************************************************************************************************************************************************
//Data Center
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dDataCenter(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dDataCenter, mxShape);

mxShapeAws3dDataCenter.prototype.cst = {
		DATA_CENTER : 'mxgraph.aws3d.dataCenter',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dDataCenter.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h / 142;
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	c.setShadow(false);
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if (isShadow == 1)
	{
		c.setShadow(true);
	}
	
	c.begin();
	c.moveTo(0, h * 0.7465);
	c.lineTo(0, h * 0.25);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.25);
	c.lineTo(w, h * 0.7465);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dDataCenter.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.7465);
	c.lineTo(0, h * 0.25);
	c.lineTo(w * 0.5, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w, h * 0.7465);
	c.lineTo(w, h * 0.25);
	c.lineTo(w * 0.5, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	c.begin();
	c.moveTo(0, h * 0.7465);
	c.lineTo(0, h * 0.25);
	c.lineTo(w * 0.5, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w, h * 0.7465);
	c.lineTo(w, h * 0.25);
	c.lineTo(w * 0.5, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();

	c.setLineCap('round');
	c.setStrokeWidth(3 * strokeWidth);

	c.begin();
	c.moveTo(w * 0.0894, h * 0.3838);
	c.lineTo(w * 0.4187, h * 0.5493);
	c.moveTo(w * 0.0894, h * 0.4331);
	c.lineTo(w * 0.4187, h * 0.5986);
	c.moveTo(w * 0.0894, h * 0.4824);
	c.lineTo(w * 0.4187, h * 0.6479);
	c.moveTo(w * 0.5854, h * 0.5493);
	c.lineTo(w * 0.9146, h * 0.3838);
	c.moveTo(w * 0.5854, h * 0.5986);
	c.lineTo(w * 0.9146, h * 0.4331);
	c.moveTo(w * 0.5854, h * 0.6479);
	c.lineTo(w * 0.9146, h * 0.4824);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7465);
	c.lineTo(0, h * 0.25);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.25);
	c.lineTo(w, h * 0.7465);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dDataCenter.prototype.cst.DATA_CENTER, mxShapeAws3dDataCenter);

//**********************************************************************************************************************************************************
//Data Server
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dDataServer(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dDataServer, mxShape);

mxShapeAws3dDataServer.prototype.cst = {
		DATA_SERVER : 'mxgraph.aws3d.dataServer',
		SHADINC_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dDataServer.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h / 106;
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	c.setShadow(false);
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if (isShadow == 1)
	{
		c.setShadow(true);
	}
	
	c.begin();
	c.moveTo(0, h * 0.6651);
	c.lineTo(0, h * 0.3349);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.3349);
	c.lineTo(w, h * 0.6651);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dDataServer.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.6651);
	c.lineTo(0, h * 0.3349);
	c.lineTo(w * 0.5, h * 0.6698);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w, h * 0.6651);
	c.lineTo(w, h * 0.3349);
	c.lineTo(w * 0.5, h * 0.6698);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	c.begin();
	c.moveTo(0, h * 0.6651);
	c.lineTo(0, h * 0.3349);
	c.lineTo(w * 0.5, h * 0.6698);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w, h * 0.6651);
	c.lineTo(w, h * 0.3349);
	c.lineTo(w * 0.5, h * 0.6698);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();

	c.setLineCap('round');
	c.setStrokeWidth(3 * strokeWidth);

	c.begin();
	c.moveTo(w * 0.0878, h * 0.4858);
	c.lineTo(w * 0.4187, h * 0.7094);
	c.moveTo(w * 0.587, h * 0.7094);
	c.lineTo(w * 0.9187, h * 0.4858);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.6651);
	c.lineTo(0, h * 0.3349);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.3349);
	c.lineTo(w, h * 0.6651);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dDataServer.prototype.cst.DATA_SERVER, mxShapeAws3dDataServer);

//**********************************************************************************************************************************************************
//Elastic Load Balancing
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dElasticLoadBalancing(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dElasticLoadBalancing, mxShape);

mxShapeAws3dElasticLoadBalancing.prototype.cst = {
		ELASTIC_LOAD_BALANCING : 'mxgraph.aws3d.elasticLoadBalancing',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dElasticLoadBalancing.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 92;
	var strokeWidth2 = strokeWidth * h / 88.17;
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	c.setShadow(false);
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if (isShadow == 1)
	{
		c.setShadow(true);
	}
	
	c.begin();
	c.moveTo(0, h * 0.7996);
	c.lineTo(0, h * 0.1985);
	c.lineTo(w * 0.3315, 0);
	c.lineTo(w * 0.6685, 0);
	c.lineTo(w, h * 0.1985);
	c.lineTo(w, h * 0.7996);
	c.lineTo(w * 0.6685, h);
	c.lineTo(w * 0.3315, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dElasticLoadBalancing.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.4026);
	c.lineTo(w * 0.3315, h * 0.6011);
	c.lineTo(w * 0.6685, h * 0.6011);
	c.lineTo(w * 0.6685, h);
	c.lineTo(w * 0.3315, h);
	c.lineTo(0, h * 0.7996);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.6685, h * 0.6011);
	c.lineTo(w, h * 0.4026);
	c.lineTo(w, h * 0.7996);
	c.lineTo(w * 0.6685, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	c.begin();
	c.moveTo(0, h * 0.4026);
	c.lineTo(w * 0.3315, h * 0.6011);
	c.lineTo(w * 0.6685, h * 0.6011);
	c.lineTo(w * 0.6685, h);
	c.lineTo(w * 0.3315, h);
	c.lineTo(0, h * 0.7996);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.6685, h * 0.6011);
	c.lineTo(w, h * 0.4026);
	c.lineTo(w, h * 0.7996);
	c.lineTo(w * 0.6685, h);
	c.close();
	c.moveTo(w * 0.3315, h * 0.6011);
	c.lineTo(w * 0.3315, h);
	c.stroke();

	c.restore();
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.337, h * 0.1395);
	c.arcTo(w * 0.3043, h * 0.1928, 0, 0, 1, w * 0.5, h * 0.1191);
	c.arcTo(w * 0.3043, h * 0.1928, 0, 0, 1, w * 0.6739, h * 0.1645);
	c.arcTo(w * 0.3261, h * 0.2155, 0, 0, 1, w * 0.8152, h * 0.3176);
	c.arcTo(w * 0.3261, h * 0.1701, 0, 0, 1, w * 0.75, h * 0.4367);
	c.arcTo(w * 0.3261, h * 0.3403, 0, 0, 1, w * 0.6033, h * 0.4854);
	c.arcTo(w * 0.3261, h * 0.2268, 0, 0, 1, w * 0.4348, h * 0.4741);
	c.arcTo(w * 0.3261, h * 0.2268, 0, 0, 1, w * 0.2848, h * 0.4094);
	c.arcTo(w * 0.3261, h * 0.2268, 0, 0, 1, w * 0.2065, h * 0.3062);
	c.arcTo(w * 0.3261, h * 0.1701, 0, 0, 1, w * 0.2446, h * 0.1928);
	c.arcTo(w * 0.2717, h * 0.1701, 0, 0, 1, w * 0.337, h * 0.1395);
	c.fill();

	c.restore();
	c.begin();
	c.moveTo(w * 0.2826, h * 0.372);
	c.lineTo(w * 0.362, h * 0.3232);
	c.lineTo(w * 0.4054, h * 0.3482);
	c.lineTo(w * 0.4457, h * 0.2654);
	c.lineTo(w * 0.4185, h * 0.2643);
	c.lineTo(w * 0.4728, h * 0.2132);
	c.lineTo(w * 0.4348, h * 0.1928);
	c.lineTo(w * 0.5141, h * 0.144);
	c.lineTo(w * 0.5837, h * 0.1883);
	c.lineTo(w * 0.5043, h * 0.2348);
	c.lineTo(w * 0.4848, h * 0.2223);
	c.lineTo(w * 0.4967, h * 0.2688);
	c.lineTo(w * 0.463, h * 0.2665);
	c.lineTo(w * 0.4304, h * 0.3346);
	c.lineTo(w * 0.4946, h * 0.2949);
	c.lineTo(w * 0.4761, h * 0.2858);
	c.lineTo(w * 0.5511, h * 0.2631);
	c.lineTo(w * 0.5261, h * 0.2472);
	c.lineTo(w * 0.6043, h * 0.1996);
	c.lineTo(w * 0.6761, h * 0.2404);
	c.lineTo(w * 0.5978, h * 0.2892);
	c.lineTo(w * 0.5652, h * 0.2699);
	c.lineTo(w * 0.5293, h * 0.3198);
	c.lineTo(w * 0.5087, h * 0.3051);
	c.lineTo(w * 0.4543, h * 0.3391);
	c.lineTo(w * 0.563, h * 0.3221);
	c.lineTo(w * 0.5598, h * 0.3017);
	c.lineTo(w * 0.6326, h * 0.3096);
	c.lineTo(w * 0.6163, h * 0.2994);
	c.lineTo(w * 0.6957, h * 0.2529);
	c.lineTo(w * 0.7674, h * 0.2938);
	c.lineTo(w * 0.687, h * 0.3425);
	c.lineTo(w * 0.6489, h * 0.321);
	c.lineTo(w * 0.5707, h * 0.3539);
	c.lineTo(w * 0.5674, h * 0.3369);
	c.lineTo(w * 0.4293, h * 0.3618);
	c.lineTo(w * 0.4641, h * 0.3834);
	c.lineTo(w * 0.3859, h * 0.4299);
	c.close();
	c.fill();
	
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7996);
	c.lineTo(0, h * 0.1985);
	c.lineTo(w * 0.3315, 0);
	c.lineTo(w * 0.6685, 0);
	c.lineTo(w, h * 0.1985);
	c.lineTo(w, h * 0.7996);
	c.lineTo(w * 0.6685, h);
	c.lineTo(w * 0.3315, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dElasticLoadBalancing.prototype.cst.ELASTIC_LOAD_BALANCING, mxShapeAws3dElasticLoadBalancing);

//**********************************************************************************************************************************************************
//Instance
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dInstance(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dInstance, mxShape);

mxShapeAws3dInstance.prototype.cst = {
		INSTANCE : 'mxgraph.aws3d.instance',
		SHADIG_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dInstance.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h / 97;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dInstance.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.634);
	c.lineTo(0, h * 0.2732);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.622, 0);
	c.lineTo(w, h * 0.2732);
	c.lineTo(w, h * 0.634);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dInstance.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dInstance.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.2732);
	c.lineTo(w * 0.5, h * 0.6392);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.634);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5, h * 0.6392);
	c.lineTo(w, h * 0.2732);
	c.lineTo(w, h * 0.6392);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.2732);
	c.lineTo(w * 0.5, h * 0.6392);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.634);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.5, h * 0.6392);
	c.lineTo(w, h * 0.2732);
	c.lineTo(w, h * 0.6392);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
	
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.374, h * 0.4742);
	c.arcTo(w * 0.0325, h * 0.0258, 0, 0, 1, w * 0.374, h * 0.4381);
	c.lineTo(w * 0.4797, h * 0.3608);
	c.arcTo(w * 0.0325, h * 0.0206, 0, 0, 1, w * 0.5203, h * 0.3608);
	c.lineTo(w * 0.626, h * 0.4381);
	c.arcTo(w * 0.0325, h * 0.0258, 0, 0, 1, w * 0.626, h * 0.4711);
	c.lineTo(w * 0.5203, h * 0.5485);
	c.arcTo(w * 0.0325, h * 0.0206, 0, 0, 1, w * 0.4797, h * 0.5485);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.634);
	c.lineTo(0, h * 0.2732);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.622, 0);
	c.lineTo(w, h * 0.2732);
	c.lineTo(w, h * 0.634);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dInstance.prototype.cst.INSTANCE, mxShapeAws3dInstance);

//**********************************************************************************************************************************************************
//Internet Gateway
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dInternetGateway(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dInternetGateway, mxShape);

mxShapeAws3dInternetGateway.prototype.cst = {
		INTERNET_GATEWAY : 'mxgraph.aws3d.internetGateway',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dInternetGateway.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 116.7;
	var strokeWidth2 = strokeWidth * h / 102.8;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dInternetGateway.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(w * 0.4199, h * 0.5447);
	c.lineTo(w * 0.4199, h * 0.035);
	c.lineTo(w * 0.8946, 0);
	c.lineTo(w, h * 0.0691);
	c.lineTo(w, h * 0.4134);
	c.lineTo(w * 0.6812, h * 0.7247);
	c.close();
	c.fillAndStroke();

	c.restore();
	c.save();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dInternetGateway.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	c.begin();
	c.moveTo(w * 0.4199, h * 0.5447);
	c.lineTo(w * 0.4199, h * 0.035);
	c.lineTo(w * 0.6838, h * 0.2072);
	c.lineTo(w * 0.6838, h * 0.7247);
	c.close();
	c.fill();
	
	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.6838, h * 0.2072);
	c.lineTo(w, h * 0.0691);
	c.lineTo(w, h * 0.4134);
	c.lineTo(w * 0.6838, h * 0.7247);
	c.close();
	c.fill();

	c.restore();
	c.setShadow(false);
	c.begin();
	c.moveTo(w * 0.4199, h * 0.5447);
	c.lineTo(w * 0.4199, h * 0.035);
	c.lineTo(w * 0.6838, h * 0.2072);
	c.lineTo(w * 0.6838, h * 0.7247);
	c.close();
	c.stroke();

	c.restore();
	c.setLineJoin('round');
	c.setShadow(false);

	c.begin();
	c.moveTo(w * 0.6838, h * 0.2072);
	c.lineTo(w, h * 0.0691);
	c.lineTo(w, h * 0.4134);
	c.lineTo(w * 0.6838, h * 0.7247);
	c.close();
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	
	c.begin();
	c.moveTo(w * 0.4199, h * 0.5447);
	c.lineTo(w * 0.4199, h * 0.035);
	c.lineTo(w * 0.8946, 0);
	c.lineTo(w, h * 0.0691);
	c.lineTo(w, h * 0.4134);
	c.lineTo(w * 0.6812, h * 0.7247);
	c.close();
	c.stroke();

	c.restore();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.929);
	c.lineTo(0, h * 0.5866);
	c.lineTo(w * 0.3171, h * 0.1031);
	c.lineTo(w * 0.5784, h * 0.2753);
	c.lineTo(w * 0.5784, h * 0.7928);
	c.lineTo(w * 0.1054, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dInternetGateway.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setShadow(false);
	c.setLineJoin('round');
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dInternetGateway.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.929);
	c.lineTo(0, h * 0.5866);
	c.lineTo(w * 0.1054, h * 0.6537);
	c.lineTo(w * 0.1054, h);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.1054, h);
	c.lineTo(w * 0.1054, h * 0.6537);
	c.lineTo(w * 0.5784, h * 0.2753);
	c.lineTo(w * 0.5784, h * 0.7928);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.929);
	c.lineTo(0, h * 0.5866);
	c.lineTo(w * 0.1054, h * 0.6537);
	c.lineTo(w * 0.1054, h);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.1054, h);
	c.lineTo(w * 0.1054, h * 0.6537);
	c.lineTo(w * 0.5784, h * 0.2753);
	c.lineTo(w * 0.5784, h * 0.7928);
	c.close();
	c.stroke();
	
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.929);
	c.lineTo(0, h * 0.5866);
	c.lineTo(w * 0.3171, h * 0.1031);
	c.lineTo(w * 0.5784, h * 0.2753);
	c.lineTo(w * 0.5784, h * 0.7928);
	c.lineTo(w * 0.1054, h);
	c.close();
	c.stroke();
	
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.7849, h * 0.5039);
	c.arcTo(w * 0.0343, h * 0.0632, 0, 0, 1, w * 0.7481, h * 0.4796);
	c.arcTo(w * 0.0857, h * 0.0973, 0, 0, 1, w * 0.7661, h * 0.3911);
	c.arcTo(w * 0.06, h * 0.0681, 0, 0, 1, w * 0.7712, h * 0.3356);
	c.arcTo(w * 0.0257, h * 0.0292, 0, 0, 1, w * 0.7952, h * 0.32);
	c.arcTo(w * 0.1285, h * 0.1459, 0, 0, 1, w * 0.8166, h * 0.2461);
	c.arcTo(w * 0.06, h * 0.0973, 0, 0, 1, w * 0.8595, h * 0.2238);
	c.arcTo(w * 0.0514, h * 0.0973, 0, 0, 1, w * 0.8937, h * 0.2743);
	c.arcTo(w * 0.0428, h * 0.0778, 0, 0, 1, w * 0.9323, h * 0.3093);
	c.arcTo(w * 0.0686, h * 0.0778, 0, 0, 1, w * 0.928, h * 0.3716);
	c.arcTo(w * 0.0857, h * 0.0973, 0, 0, 1, w * 0.8972, h * 0.4125);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxShapeAws3dInternetGateway.prototype.cst.INTERNET_GATEWAY, mxShapeAws3dInternetGateway);

//**********************************************************************************************************************************************************
//Oracle Data Center
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dOracleDataCenter(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dOracleDataCenter, mxShape);

mxShapeAws3dOracleDataCenter.prototype.cst = {
		ORACLE_DATA_CENTER : 'mxgraph.aws3d.oracleDataCenter'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dOracleDataCenter.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h /142;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	c.setStrokeWidth(strokeWidth);
	
	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dOracleDataCenter.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7464);
	c.lineTo(0, h * 0.25);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.25);
	c.lineTo(w, h * 0.7464);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dOracleDataCenter.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	c.setAlpha('0.1');
	
	c.begin();
	c.moveTo(0, h * 0.7464);
	c.lineTo(0, h * 0.25);
	c.lineTo(w * 0.5, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();

	c.setAlpha('0.3');
	c.begin();
	c.moveTo(w * 0.5, h * 0.5);
	c.lineTo(w, h * 0.25);
	c.lineTo(w, h * 0.7464);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.setFillColor('#ff0000');

	c.begin();
	c.moveTo(0, h * 0.5866);
	c.lineTo(w * 0.5, h * 0.8359);
	c.lineTo(w, h * 0.5866);
	c.lineTo(w, h * 0.6986);
	c.lineTo(w * 0.5, h * 0.9486);
	c.lineTo(0, h * 0.6986);
	c.fill();

	c.setStrokeWidth(0.5 * strokeWidth);
	c.setStrokeColor('#ffffff');
	c.setFillColor('#ffffff');
	
	c.begin();
	c.moveTo(0, h * 0.5866);
	c.lineTo(w * 0.5, h * 0.8359);
	c.lineTo(w, h * 0.5866);
	c.moveTo(w, h * 0.6986);
	c.lineTo(w * 0.5, h * 0.9486);
	c.lineTo(0, h * 0.6986);
	c.stroke();
	
	c.begin();
	c.moveTo(w * 0.0813, h * 0.7113);
	c.arcTo(w * 0.0569, h * 0.0493, 0, 0, 1, w * 0.065, h * 0.6831);
	c.arcTo(w * 0.065, h * 0.0563, 0, 0, 1, w * 0.065, h * 0.6613);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 1, w * 0.0797, h * 0.6549);
	c.lineTo(w * 0.122, h * 0.6754);
	c.arcTo(w * 0.065, h * 0.0563, 0, 0, 1, w * 0.1358, h * 0.6937);
	c.arcTo(w * 0.065, h * 0.0563, 0, 0, 1, w * 0.139, h * 0.7232);
	c.arcTo(w * 0.0179, h * 0.0155, 0, 0, 1, w * 0.1187, h * 0.7296);
	c.close();
	c.moveTo(w * 0.1163, h * 0.7183);
	c.arcTo(w * 0.0089, h * 0.0077, 0, 0, 0, w * 0.1285, h * 0.7148);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 0, w * 0.1293, h * 0.7021);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 0, w * 0.1179, h * 0.6831);
	c.lineTo(w * 0.087, h * 0.6676);
	c.arcTo(w * 0.0081, h * 0.007, 0, 0, 0, w * 0.0764, h * 0.6697);
	c.arcTo(w * 0.0325, h * 0.0352, 0, 0, 0, w * 0.078, h * 0.6937);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 0, w * 0.087, h * 0.7035);
	c.close();
	c.moveTo(w * 0.1439, h * 0.743);
	c.lineTo(w * 0.1439, h * 0.6866);
	c.lineTo(w * 0.1846, h * 0.707);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.1967, h * 0.7183);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.2, h * 0.738);
	c.arcTo(w * 0.0138, h * 0.0155, 0, 0, 1, w * 0.1813, h * 0.743);
	c.lineTo(w * 0.1992, h * 0.769);
	c.lineTo(w * 0.187, h * 0.7641);
	c.lineTo(w * 0.1577, h * 0.7218);
	c.lineTo(w * 0.1854, h * 0.7345);
	c.arcTo(w * 0.0041, h * 0.0035, 0, 0, 0, w * 0.1911, h * 0.7317);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 0, w * 0.1894, h * 0.7225);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 0, w * 0.1821, h * 0.7155);
	c.lineTo(w * 0.1528, h * 0.7007);
	c.lineTo(w * 0.1528, h * 0.7472);
	c.close();
	c.moveTo(w * 0.2008, h * 0.7711);
	c.lineTo(w * 0.2293, h * 0.7338);
	c.arcTo(w * 0.0065, h * 0.0056, 0, 0, 1, w * 0.2382, h * 0.7324);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.2431, h * 0.7415);
	c.lineTo(w * 0.2699, h * 0.8035);
	c.lineTo(w * 0.2602, h * 0.8007);
	c.lineTo(w * 0.252, h * 0.7859);
	c.lineTo(w * 0.2293, h * 0.7754);
	c.lineTo(w * 0.2244, h * 0.7634);
	c.lineTo(w * 0.248, h * 0.7739);
	c.lineTo(w * 0.235, h * 0.7444);
	c.lineTo(w * 0.2122, h * 0.7768);
	c.close();
	c.moveTo(w * 0.3244, h * 0.8225);
	c.lineTo(w * 0.3171, h * 0.8289);
	c.lineTo(w * 0.2854, h * 0.8127);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.2724, h * 0.7986);
	c.arcTo(w * 0.0569, h * 0.0493, 0, 0, 1, w * 0.265, h * 0.7746);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.2683, h * 0.762);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 1, w * 0.2829, h * 0.757);
	c.lineTo(w * 0.3228, h * 0.7761);
	c.lineTo(w * 0.3179, h * 0.7831);
	c.lineTo(w * 0.2878, h * 0.7683);
	c.arcTo(w * 0.0081, h * 0.007, 0, 0, 0, w * 0.2789, h * 0.7697);
	c.arcTo(w * 0.0244, h * 0.0211, 0, 0, 0, w * 0.2748, h * 0.7831);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 0, w * 0.2878, h * 0.8042);
	c.close();
	c.moveTo(w * 0.3276, h * 0.7789);
	c.lineTo(w * 0.3366, h * 0.7831);
	c.lineTo(w * 0.3366, h * 0.8289);
	c.lineTo(w * 0.3805, h * 0.8507);
	c.lineTo(w * 0.3748, h * 0.857);
	c.lineTo(w * 0.3317, h * 0.8359);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 1, w * 0.3276, h * 0.8275);
	c.close();
	c.moveTo(w * 0.435, h * 0.8775);
	c.lineTo(w * 0.4325, h * 0.8866);
	c.lineTo(w * 0.3959, h * 0.8683);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.3862, h * 0.8563);
	c.arcTo(w * 0.0528, h * 0.0458, 0, 0, 1, w * 0.3805, h * 0.8183);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 1, w * 0.3951, h * 0.8134);
	c.lineTo(w * 0.435, h * 0.8324);
	c.lineTo(w * 0.4285, h * 0.838);
	c.lineTo(w * 0.4008, h * 0.8246);
	c.arcTo(w * 0.0098, h * 0.0085, 0, 0, 0, w * 0.3878, h * 0.831);
	c.lineTo(w * 0.4333, h * 0.8542);
	c.lineTo(w * 0.426, h * 0.8606);
	c.lineTo(w * 0.3878, h * 0.8415);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 0, w * 0.3976, h * 0.8585);
	c.close();

	c.moveTo(w * 0.6171, h * 0.8063);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 1, w * 0.6366, h * 0.8092);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 1, w * 0.639, h * 0.8303);
	c.arcTo(w * 0.065, h * 0.0563, 0, 0, 1, w * 0.6211, h * 0.8592);
	c.lineTo(w * 0.5894, h * 0.8761);
	c.arcTo(w * 0.0203, h * 0.0176, 0, 0, 1, w * 0.565, h * 0.8732);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.5659, h * 0.8458);
	c.arcTo(w * 0.0488, h * 0.0422, 0, 0, 1, w * 0.5805, h * 0.8246);
	c.close();
	c.moveTo(w * 0.5886, h * 0.8296);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 0, w * 0.5748, h * 0.8472);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 0, w * 0.574, h * 0.862);
	c.arcTo(w * 0.0098, h * 0.0085, 0, 0, 0, w * 0.587, h * 0.8676);
	c.lineTo(w * 0.6163, h * 0.8528);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 0, w * 0.6285, h * 0.8359);
	c.arcTo(w * 0.0244, h * 0.0211, 0, 0, 0, w * 0.6293, h * 0.8225);
	c.arcTo(w * 0.0098, h * 0.0085, 0, 0, 0, w * 0.6163, h * 0.8155);
	c.close();

	c.moveTo(w * 0.64, h * 0.85);
	c.lineTo(w * 0.64, h * 0.7930);
	c.lineTo(w * 0.6854, h * 0.7718);
	c.arcTo(w * 0.0106, h * 0.0092, 0, 0, 1, w * 0.7008, h * 0.7782);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.6959, h * 0.8);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.6805, h * 0.8127);
	c.lineTo(w * 0.6992, h * 0.8218);
	c.lineTo(w * 0.6854, h * 0.8282);
	c.lineTo(w * 0.6569, h * 0.8141);
	c.lineTo(w * 0.6805, h * 0.8021);
	c.arcTo(w * 0.0203, h * 0.0176, 0, 0, 0, w * 0.6894, h * 0.7923);
	c.arcTo(w * 0.0244, h * 0.0211, 0, 0, 0, w * 0.6894, h * 0.7845);
	c.arcTo(w * 0.0041, h * 0.0035, 0, 0, 0, w * 0.6837, h * 0.7831);
	c.lineTo(w * 0.6528, h * 0.7979);
	c.lineTo(w * 0.6528, h * 0.8437);
	c.close();
	c.moveTo(w * 0.7, h * 0.8204);
	c.lineTo(w * 0.7301, h * 0.7507);
	c.arcTo(w * 0.0098, h * 0.0085, 0, 0, 1, w * 0.7358, h * 0.7444);
	c.arcTo(w * 0.0098, h * 0.0085, 0, 0, 1, w * 0.7415, h * 0.7486);
	c.lineTo(w * 0.7699, h * 0.7852);
	c.lineTo(w * 0.7602, h * 0.7908);
	c.lineTo(w * 0.7537, h * 0.7838);
	c.lineTo(w * 0.7276, h * 0.7958);
	c.lineTo(w * 0.7228, h * 0.788);
	c.lineTo(w * 0.748, h * 0.7768);
	c.lineTo(w * 0.7358, h * 0.7585);
	c.lineTo(w * 0.7114, h * 0.8155);
	c.close();
	c.moveTo(w * 0.8244, h * 0.7486);
	c.lineTo(w * 0.8171, h * 0.762);
	c.lineTo(w * 0.7894, h * 0.7761);
	c.arcTo(w * 0.0244, h * 0.0211, 0, 0, 1, w * 0.7683, h * 0.7746);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.7667, h * 0.7507);
	c.arcTo(w * 0.0488, h * 0.0423, 0, 0, 1, w * 0.7937, h * 0.7162);
	c.lineTo(w * 0.822, h * 0.7035);
	c.lineTo(w * 0.8171, h * 0.7155);
	c.lineTo(w * 0.7902, h * 0.7296);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 0, w * 0.778, h * 0.743);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 0, w * 0.7756, h * 0.7606);
	c.arcTo(w * 0.0077, h * 0.0067, 0, 0, 0, w * 0.787, h * 0.767);
	c.close();
	c.moveTo(w * 0.8366, h * 0.6949);
	c.lineTo(w * 0.8366, h * 0.7423);
	c.lineTo(w * 0.878, h * 0.7231);
	c.lineTo(w * 0.874, h * 0.7338);
	c.lineTo(w * 0.8333, h * 0.7535);
	c.arcTo(w * 0.0041, h * 0.0035, 0, 0, 1, w * 0.8268, h * 0.75);
	c.lineTo(w * 0.8268, h * 0.7007);
	c.close();
	c.moveTo(w * 0.9342, h * 0.6472);
	c.lineTo(w * 0.9293, h * 0.6599);
	c.lineTo(w * 0.9033, h * 0.6725);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 0, w * 0.8927, h * 0.6817);
	c.arcTo(w * 0.0406, h * 0.0352, 0, 0, 0, w * 0.887, h * 0.6937);
	c.lineTo(w * 0.9309, h * 0.6725);
	c.lineTo(w * 0.9268, h * 0.6845);
	c.lineTo(w * 0.887, h * 0.7035);
	c.arcTo(w * 0.0089, h * 0.0077, 0, 0, 0, w * 0.8992, h * 0.7106);
	c.lineTo(w * 0.935, h * 0.693);
	c.lineTo(w * 0.9285, h * 0.7063);
	c.lineTo(w * 0.9008, h * 0.7197);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 1, w * 0.8829, h * 0.7204);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.8764, h * 0.7028);
	c.arcTo(w * 0.065, h * 0.0563, 0, 0, 1, w * 0.8959, h * 0.6669);
	c.fill();

	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7464);
	c.lineTo(0, h * 0.25);
	c.lineTo(w * 0.5, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.5, h * 0.5);
	c.lineTo(w, h * 0.25);
	c.lineTo(w, h * 0.7464);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
	
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7464);
	c.lineTo(0, h * 0.25);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.25);
	c.lineTo(w, h * 0.7464);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
	
	c.restore();
	c.setShadow(false);
	c.setStrokeWidth(3 * strokeWidth);
	c.setLineCap('round');
	c.begin();
	c.moveTo(w * 0.0894, h * 0.3838);
	c.lineTo(w * 0.4187, h * 0.5493);
	c.moveTo(w * 0.0894, h * 0.4331);
	c.lineTo(w * 0.4187, h * 0.5986);
	c.moveTo(w * 0.0894, h * 0.4824);
	c.lineTo(w * 0.4187, h * 0.6479);
	c.moveTo(w * 0.5854, h * 0.5492);
	c.lineTo(w * 0.9146, h * 0.3838);
	c.moveTo(w * 0.5854, h * 0.5986);
	c.lineTo(w * 0.9146, h * 0.4331);
	c.moveTo(w * 0.5854, h * 0.6479);
	c.lineTo(w * 0.9146, h * 0.4824);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dOracleDataCenter.prototype.cst.ORACLE_DATA_CENTER, mxShapeAws3dOracleDataCenter);

//**********************************************************************************************************************************************************
//Oracle Database Server
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dOracleDatabaseServer(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dOracleDatabaseServer, mxShape);

mxShapeAws3dOracleDatabaseServer.prototype.cst = {
		ORACLE_DB_SERVER : 'mxgraph.aws3d.oracleDbServer'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dOracleDatabaseServer.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h /142;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	c.setStrokeWidth(strokeWidth);
	
	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dOracleDatabaseServer.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.626, 0);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3346);
	c.lineTo(w, h * 0.7331);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dOracleDatabaseServer.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	c.setAlpha('0.1');
	
	c.begin();
	c.moveTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.126, h * 0.267);
	c.lineTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.close();
	c.moveTo(w * 0.874, h * 0.267);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3308);
	c.fill();

	c.setAlpha('0.3');
	c.begin();
	c.moveTo(w * 0.5, h);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.622, h * 0.4023);
	c.lineTo(w * 0.874, h * 0.267);
	c.lineTo(w, h * 0.3308);
	c.lineTo(w, h * 0.7331);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.setFillColor('#ff0000');

	c.begin();
	c.moveTo(0, h * 0.5586);
	c.lineTo(w * 0.5, h * 0.8248);
	c.lineTo(w, h * 0.5586);
	c.lineTo(w, h * 0.6782);
	c.lineTo(w * 0.5, h * 0.9453);
	c.lineTo(0, h * 0.6782);
	c.fill();

	c.setStrokeWidth(0.5 * strokeWidth);
	c.setStrokeColor('#ffffff');
	c.setFillColor('#ffffff');
	
	c.begin();
	c.moveTo(0, h * 0.5586);
	c.lineTo(w * 0.5, h * 0.8248);
	c.lineTo(w, h * 0.5586);
	c.moveTo(w, h * 0.6782);
	c.lineTo(w * 0.5, h * 0.9453);
	c.lineTo(0, h * 0.6782);
	c.stroke();
	
	c.begin();
	c.moveTo(w * 0.0813, h * 0.6918);
	c.arcTo(w * 0.0569, h * 0.0526, 0, 0, 1, w * 0.065, h * 0.6616);
	c.arcTo(w * 0.065, h * 0.0601, 0, 0, 1, w * 0.065, h * 0.6384);
	c.arcTo(w * 0.0163, h * 0.0151, 0, 0, 1, w * 0.0797, h * 0.6315);
	c.lineTo(w * 0.122, h * 0.6534);
	c.arcTo(w * 0.065, h * 0.0601, 0, 0, 1, w * 0.1358, h * 0.673);
	c.arcTo(w * 0.065, h * 0.0601, 0, 0, 1, w * 0.139, h * 0.7045);
	c.arcTo(w * 0.0179, h * 0.0165, 0, 0, 1, w * 0.1187, h * 0.7113);
	c.close();
	c.moveTo(w * 0.1163, h * 0.6992);
	c.arcTo(w * 0.0089, h * 0.0082, 0, 0, 0, w * 0.1285, h * 0.6955);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 0, w * 0.1293, h * 0.6819);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 0, w * 0.1179, h * 0.6616);
	c.lineTo(w * 0.087, h * 0.6451);
	c.arcTo(w * 0.0081, h * 0.0075, 0, 0, 0, w * 0.0764, h * 0.6473);
	c.arcTo(w * 0.0325, h * 0.0376, 0, 0, 0, w * 0.078, h * 0.673);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 0, w * 0.087, h * 0.6834);
	c.close();
	c.moveTo(w * 0.1439, h * 0.7256);
	c.lineTo(w * 0.1439, h * 0.6654);
	c.lineTo(w * 0.1846, h * 0.6872);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 1, w * 0.1967, h * 0.6992);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 1, w * 0.2, h * 0.7203);
	c.arcTo(w * 0.0138, h * 0.0165, 0, 0, 1, w * 0.1813, h * 0.7256);
	c.lineTo(w * 0.1992, h * 0.7534);
	c.lineTo(w * 0.187, h * 0.7481);
	c.lineTo(w * 0.1577, h * 0.7029);
	c.lineTo(w * 0.1854, h * 0.7165);
	c.arcTo(w * 0.0041, h * 0.0037, 0, 0, 0, w * 0.1911, h * 0.7135);
	c.arcTo(w * 0.0163, h * 0.0151, 0, 0, 0, w * 0.1894, h * 0.7037);
	c.arcTo(w * 0.0325, h * 0.0301, 0, 0, 0, w * 0.1821, h * 0.6962);
	c.lineTo(w * 0.1528, h * 0.6804);
	c.lineTo(w * 0.1528, h * 0.7301);
	c.close();
	c.moveTo(w * 0.2008, h * 0.7556);
	c.lineTo(w * 0.2293, h * 0.7158);
	c.arcTo(w * 0.0065, h * 0.006, 0, 0, 1, w * 0.2382, h * 0.7143);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 1, w * 0.2431, h * 0.724);
	c.lineTo(w * 0.2699, h * 0.7902);
	c.lineTo(w * 0.2602, h * 0.7872);
	c.lineTo(w * 0.252, h * 0.7714);
	c.lineTo(w * 0.2293, h * 0.7602);
	c.lineTo(w * 0.2244, h * 0.7474);
	c.lineTo(w * 0.248, h * 0.7586);
	c.lineTo(w * 0.235, h * 0.7271);
	c.lineTo(w * 0.2122, h * 0.7617);
	c.close();
	c.moveTo(w * 0.3244, h * 0.8105);
	c.lineTo(w * 0.3171, h * 0.8173);
	c.lineTo(w * 0.2854, h * 0.8);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 1, w * 0.2724, h * 0.785);
	c.arcTo(w * 0.0569, h * 0.0526, 0, 0, 1, w * 0.265, h * 0.7593);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 1, w * 0.2683, h * 0.7459);
	c.arcTo(w * 0.0163, h * 0.0151, 0, 0, 1, w * 0.2829, h * 0.7405);
	c.lineTo(w * 0.3228, h * 0.7609);
	c.lineTo(w * 0.3179, h * 0.7684);
	c.lineTo(w * 0.2878, h * 0.7526);
	c.arcTo(w * 0.0081, h * 0.0075, 0, 0, 0, w * 0.2789, h * 0.7541);
	c.arcTo(w * 0.0244, h * 0.0225, 0, 0, 0, w * 0.2748, h * 0.7684);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 0, w * 0.2878, h * 0.7909);
	c.close();
	c.moveTo(w * 0.3276, h * 0.7639);
	c.lineTo(w * 0.3366, h * 0.7684);
	c.lineTo(w * 0.3366, h * 0.8173);
	c.lineTo(w * 0.3805, h * 0.8406);
	c.lineTo(w * 0.3748, h * 0.8473);
	c.lineTo(w * 0.3317, h * 0.8248);
	c.arcTo(w * 0.0163, h * 0.0151, 0, 0, 1, w * 0.3276, h * 0.8158);
	c.close();
	c.moveTo(w * 0.435, h * 0.8692);
	c.lineTo(w * 0.4325, h * 0.8789);
	c.lineTo(w * 0.3959, h * 0.8594);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 1, w * 0.3862, h * 0.8466);
	c.arcTo(w * 0.0528, h * 0.0489, 0, 0, 1, w * 0.3805, h * 0.806);
	c.arcTo(w * 0.0163, h * 0.0151, 0, 0, 1, w * 0.3951, h * 0.8008);
	c.lineTo(w * 0.435, h * 0.821);
	c.lineTo(w * 0.4285, h * 0.827);
	c.lineTo(w * 0.4008, h * 0.8127);
	c.arcTo(w * 0.0098, h * 0.0091, 0, 0, 0, w * 0.3878, h * 0.8196);
	c.lineTo(w * 0.4333, h * 0.8443);
	c.lineTo(w * 0.426, h * 0.8512);
	c.lineTo(w * 0.3878, h * 0.8308);
	c.arcTo(w * 0.0325, h * 0.0301, 0, 0, 0, w * 0.3976, h * 0.8489);
	c.close();

	c.moveTo(w * 0.6171, h * 0.7932);
	c.arcTo(w * 0.0163, h * 0.0151, 0, 0, 1, w * 0.6366, h * 0.7963);
	c.arcTo(w * 0.0325, h * 0.0301, 0, 0, 1, w * 0.639, h * 0.8188);
	c.arcTo(w * 0.065, h * 0.0601, 0, 0, 1, w * 0.6211, h * 0.8497);
	c.lineTo(w * 0.5894, h * 0.8677);
	c.arcTo(w * 0.0203, h * 0.0188, 0, 0, 1, w * 0.565, h * 0.8646);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 1, w * 0.5659, h * 0.8354);
	c.arcTo(w * 0.0488, h * 0.0451, 0, 0, 1, w * 0.5805, h * 0.8127);
	c.close();
	c.moveTo(w * 0.5886, h * 0.8181);
	c.arcTo(w * 0.0325, h * 0.0301, 0, 0, 0, w * 0.5748, h * 0.8368);
	c.arcTo(w * 0.0325, h * 0.0301, 0, 0, 0, w * 0.574, h * 0.8527);
	c.arcTo(w * 0.0098, h * 0.0091, 0, 0, 0, w * 0.587, h * 0.8586);
	c.lineTo(w * 0.6163, h * 0.8428);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 0, w * 0.6285, h * 0.8248);
	c.arcTo(w * 0.0244, h * 0.0225, 0, 0, 0, w * 0.6293, h * 0.8105);
	c.arcTo(w * 0.0098, h * 0.0091, 0, 0, 0, w * 0.6163, h * 0.803);
	c.close();
	c.moveTo(w * 0.64, h * 0.8398);
	c.lineTo(w * 0.64, h * 0.779);
	c.lineTo(w * 0.6854, h * 0.7563);
	c.arcTo(w * 0.0106, h * 0.0098, 0, 0, 1, w * 0.7008, h * 0.7632);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 1, w * 0.6959, h * 0.7865);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 1, w * 0.6805, h * 0.8);
	c.lineTo(w * 0.6992, h * 0.8097);
	c.lineTo(w * 0.6854, h * 0.8166);
	c.lineTo(w * 0.6569, h * 0.8015);
	c.lineTo(w * 0.6805, h * 0.7887);
	c.arcTo(w * 0.0203, h * 0.0188, 0, 0, 0, w * 0.6894, h * 0.7782);
	c.arcTo(w * 0.0244, h * 0.0225, 0, 0, 0, w * 0.6894, h * 0.7699);
	c.arcTo(w * 0.0041, h * 0.0037, 0, 0, 0, w * 0.6837, h * 0.7684);
	c.lineTo(w * 0.6528, h * 0.7842);
	c.lineTo(w * 0.6528, h * 0.8331);
	c.close();
	c.moveTo(w * 0.7, h * 0.8082);
	c.lineTo(w * 0.7301, h * 0.7338);
	c.arcTo(w * 0.0098, h * 0.0091, 0, 0, 1, w * 0.7358, h * 0.7271);
	c.arcTo(w * 0.0098, h * 0.0091, 0, 0, 1, w * 0.7415, h * 0.7316);
	c.lineTo(w * 0.7699, h * 0.7707);
	c.lineTo(w * 0.7602, h * 0.7766);
	c.lineTo(w * 0.7537, h * 0.7692);
	c.lineTo(w * 0.7276, h * 0.782);
	c.lineTo(w * 0.7228, h * 0.7736);
	c.lineTo(w * 0.748, h * 0.7617);
	c.lineTo(w * 0.7358, h * 0.7421);
	c.lineTo(w * 0.7114, h * 0.803);
	c.close();
	c.moveTo(w * 0.8244, h * 0.7316);
	c.lineTo(w * 0.8171, h * 0.7459);
	c.lineTo(w * 0.7894, h * 0.7609);
	c.arcTo(w * 0.0244, h * 0.0225, 0, 0, 1, w * 0.7683, h * 0.7593);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 1, w * 0.7667, h * 0.7338);
	c.arcTo(w * 0.0488, h * 0.0452, 0, 0, 1, w * 0.7937, h * 0.697);
	c.lineTo(w * 0.822, h * 0.6834);
	c.lineTo(w * 0.8171, h * 0.6962);
	c.lineTo(w * 0.7902, h * 0.7113);
	c.arcTo(w * 0.0325, h * 0.0301, 0, 0, 0, w * 0.778, h * 0.7256);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 0, w * 0.7756, h * 0.7444);
	c.arcTo(w * 0.0077, h * 0.0072, 0, 0, 0, w * 0.787, h * 0.7512);
	c.close();
	c.moveTo(w * 0.8366, h * 0.6742);
	c.lineTo(w * 0.8366, h * 0.7248);
	c.lineTo(w * 0.878, h * 0.7043);
	c.lineTo(w * 0.874, h * 0.7158);
	c.lineTo(w * 0.8333, h * 0.7368);
	c.arcTo(w * 0.0041, h * 0.0037, 0, 0, 1, w * 0.8268, h * 0.7324);
	c.lineTo(w * 0.8268, h * 0.6804);
	c.close();
	c.moveTo(w * 0.9342, h * 0.6233);
	c.lineTo(w * 0.9293, h * 0.6369);
	c.lineTo(w * 0.9033, h * 0.6503);
	c.arcTo(w * 0.0325, h * 0.0301, 0, 0, 0, w * 0.8927, h * 0.6601);
	c.arcTo(w * 0.0406, h * 0.0376, 0, 0, 0, w * 0.887, h * 0.6729);
	c.lineTo(w * 0.9309, h * 0.6503);
	c.lineTo(w * 0.9268, h * 0.6631);
	c.lineTo(w * 0.887, h * 0.6834);
	c.arcTo(w * 0.0089, h * 0.0082, 0, 0, 0, w * 0.8992, h * 0.691);
	c.lineTo(w * 0.935, h * 0.6722);
	c.lineTo(w * 0.9285, h * 0.6864);
	c.lineTo(w * 0.9008, h * 0.7007);
	c.arcTo(w * 0.0163, h * 0.0151, 0, 0, 1, w * 0.8829, h * 0.7015);
	c.arcTo(w * 0.0407, h * 0.0376, 0, 0, 1, w * 0.8764, h * 0.6827);
	c.arcTo(w * 0.065, h * 0.0601, 0, 0, 1, w * 0.8959, h * 0.6443);
	c.fill();

	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');

	c.begin();
	c.moveTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.126, h * 0.267);
	c.lineTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.622, h * 0.4023);
	c.lineTo(w * 0.874, h * 0.267);
	c.lineTo(w * 0.874, h * 0.1316);
	c.moveTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.267);
	c.moveTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.5, h);
	c.moveTo(w, h * 0.3346);
	c.lineTo(w * 0.87, h * 0.267);
	c.moveTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.622, h * 0.4023);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.626, 0);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3346);
	c.lineTo(w, h * 0.7331);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dOracleDatabaseServer.prototype.cst.ORACLE_DB_SERVER, mxShapeAws3dOracleDatabaseServer);//zzz

//**********************************************************************************************************************************************************
//RDS Master
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dRdsMaster(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dRdsMaster, mxShape);

mxShapeAws3dRdsMaster.prototype.cst = {
		RDS_MASTER : 'mxgraph.aws3d.rdsMaster',
		SHADIG_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dRdsMaster.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h /133;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	c.setStrokeWidth(strokeWidth);
	
	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dRdsMaster.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.626, 0);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3346);
	c.lineTo(w, h * 0.7331);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dRdsMaster.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dRdsMaster.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.126, h * 0.267);
	c.lineTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.close();
	c.moveTo(w * 0.874, h * 0.267);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3308);
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5, h);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.622, h * 0.4023);
	c.lineTo(w * 0.874, h * 0.267);
	c.lineTo(w, h * 0.3308);
	c.lineTo(w, h * 0.7331);
	c.close();
	c.fill();
	
	c.restore();

	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.setShadow(false);

	c.begin();
	c.moveTo(w * 0.1878, h * 0.1932);
	c.lineTo(w * 0.4854, h * 0.0414);
	c.lineTo(w * 0.5886, h * 0.094);
	c.lineTo(w * 0.4455, h * 0.2308);
	c.lineTo(w * 0.7122, h * 0.1579);
	c.lineTo(w * 0.8171, h * 0.2098);
	c.lineTo(w * 0.5187, h * 0.3617);
	c.lineTo(w * 0.4537, h * 0.3293);
	c.lineTo(w * 0.7016, h * 0.2053);
	c.lineTo(w * 0.3854, h * 0.2947);
	c.lineTo(w * 0.3187, h * 0.2602);
	c.lineTo(w * 0.4959, h * 0.0992);
	c.lineTo(w * 0.2504, h * 0.2256);
	c.close();
	c.fill();
	
	c.setLineJoin('round');

	c.begin();
	c.moveTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.126, h * 0.267);
	c.lineTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.622, h * 0.4023);
	c.lineTo(w * 0.874, h * 0.267);
	c.lineTo(w * 0.874, h * 0.1316);
	c.moveTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.267);
	c.moveTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.5, h);
	c.moveTo(w, h * 0.3346);
	c.lineTo(w * 0.87, h * 0.267);
	c.moveTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.622, h * 0.4023);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.626, 0);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3346);
	c.lineTo(w, h * 0.7331);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dRdsMaster.prototype.cst.RDS_MASTER, mxShapeAws3dRdsMaster);

//**********************************************************************************************************************************************************
//RDS
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dRds(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dRds, mxShape);

mxShapeAws3dRds.prototype.cst = {
		RDS : 'mxgraph.aws3d.rds',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dRds.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h /133;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	c.setStrokeWidth(strokeWidth);
	
	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dRds.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.626, 0);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3346);
	c.lineTo(w, h * 0.7331);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dRds.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dRds.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.126, h * 0.267);
	c.lineTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.close();
	c.moveTo(w * 0.874, h * 0.267);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3308);
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5, h);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.622, h * 0.4023);
	c.lineTo(w * 0.874, h * 0.267);
	c.lineTo(w, h * 0.3308);
	c.lineTo(w, h * 0.7331);
	c.close();
	c.fill();
	
	c.restore();

	c.setFillColor('#ffffff');
	c.setShadow(false);
	c.begin();
	c.moveTo(0, h * 0.6053);
	c.lineTo(w * 0.5, h * 0.8722);
	c.lineTo(w, h * 0.6053);
	c.lineTo(w, h * 0.6278);
	c.lineTo(w * 0.5, h * 0.8947);
	c.lineTo(0, h * 0.6278);
	c.close();
	c.fill();

	c.setLineJoin('round');

	c.begin();
	c.moveTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.126, h * 0.267);
	c.lineTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.622, h * 0.4023);
	c.lineTo(w * 0.874, h * 0.267);
	c.lineTo(w * 0.874, h * 0.1316);
	c.moveTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.267);
	c.moveTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.5, h);
	c.moveTo(w, h * 0.3346);
	c.lineTo(w * 0.87, h * 0.267);
	c.moveTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.622, h * 0.4023);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.626, 0);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3346);
	c.lineTo(w, h * 0.7331);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dRds.prototype.cst.RDS, mxShapeAws3dRds);

//**********************************************************************************************************************************************************
//Route 53
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dRoute53(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dRoute53, mxShape);

mxShapeAws3dRoute53.prototype.cst = {
		ROUTE_53 : 'mxgraph.aws3d.route53',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dRoute53.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 117;
	var strokeWidth2 = strokeWidth * h /134.4;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	c.setStrokeWidth(strokeWidth);
	
	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dRoute53.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.6994);
	c.lineTo(0, h * 0.2009);
	c.lineTo(w * 0.0427, h * 0.0781);
	c.lineTo(w * 0.7974, 0);
	c.lineTo(w, h * 0.1004);
	c.lineTo(w, h * 0.5915);
	c.lineTo(w * 0.8376, h * 0.9784);
	c.lineTo(w * 0.5983, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dRoute53.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dRoute53.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.2009);
	c.lineTo(w * 0.6009, h * 0.5007);
	c.lineTo(w * 0.8376, h * 0.4799);
	c.lineTo(w * 0.8376, h * 0.9784);
	c.lineTo(w * 0.5966, h);
	c.lineTo(0, h * 0.6979);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.8348, h * 0.4861);
	c.lineTo(w * 0.9985, h * 0.0992);
	c.lineTo(w, h * 0.5952);
	c.lineTo(w * 0.8404, h * 0.9747);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');

	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);

	c.begin();
	c.moveTo(w * 0.5855, h * 0.1079);
	c.arcTo(w * 0.094, h * 0.0744, 0, 0, 0, w * 0.6863, h * 0.1548);
	c.arcTo(w * 0.0855, h * 0.0446, 0, 0, 0, w * 0.7761, h * 0.2031);
	c.lineTo(w * 0.7726, h * 0.2455);
	c.arcTo(w * 0.0769, h * 0.0298, 0, 0, 0, w * 0.694, h * 0.2693);
	c.arcTo(w * 0.0684, h * 0.0446, 0, 0, 1, w * 0.5897, h * 0.3051);
	c.arcTo(w * 0.4274, h * 0.372, 0, 0, 0, w * 0.4573, h * 0.2753);
	c.arcTo(w * 0.0855, h * 0.0744, 0, 0, 0, w * 0.4188, h * 0.2344);
	c.lineTo(w * 0.3846, h * 0.2083);
	c.arcTo(w * 0.0769, h * 0.0372, 0, 0, 1, w * 0.4103, h * 0.1525);
	c.arcTo(w * 0.0855, h * 0.0409, 0, 0, 0, w * 0.4906, h * 0.1079);
	c.close();
	c.fill();

	c.begin();
	c.moveTo(0, h * 0.2009);
	c.lineTo(w * 0.6009, h * 0.5007);
	c.lineTo(w * 0.8376, h * 0.4799);
	c.lineTo(w * 0.8376, h * 0.9784);
	c.lineTo(w * 0.5966, h);
	c.lineTo(0, h * 0.6979);
	c.close();
	c.moveTo(w * 0.8348, h * 0.4861);
	c.lineTo(w * 0.9985, h * 0.0992);
	c.lineTo(w, h * 0.5952);
	c.lineTo(w * 0.8404, h * 0.9747);
	c.close();
	c.moveTo(w * 0.6009, h * 0.5007);
	c.lineTo(w * 0.6009, h);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.6994);
	c.lineTo(0, h * 0.2009);
	c.lineTo(w * 0.0427, h * 0.0781);
	c.lineTo(w * 0.7974, 0);
	c.lineTo(w, h * 0.1004);
	c.lineTo(w, h * 0.5915);
	c.lineTo(w * 0.8376, h * 0.9784);
	c.lineTo(w * 0.5983, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dRoute53.prototype.cst.ROUTE_53, mxShapeAws3dRoute53);

//**********************************************************************************************************************************************************
//S3 Bucket
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dS3Bucket(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dS3Bucket, mxShape);

mxShapeAws3dS3Bucket.prototype.cst = {
		S3_BUCKET : 'mxgraph.aws3d.s3Bucket',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dS3Bucket.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 61.5;
	var strokeWidth2 = strokeWidth * h / 63.8;
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	c.setShadow(false);
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if (isShadow == 1)
	{
		c.setShadow(true);
	}
	
	c.begin();
	c.moveTo(0, h * 0.2774);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.2774);
	c.lineTo(w * 0.7967, h * 0.8307);
	c.lineTo(w * 0.5, h);
	c.lineTo(w * 0.1951, h * 0.8307);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dS3Bucket.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.2774);
	c.lineTo(w * 0.5, h * 0.5564);
	c.lineTo(w * 0.5, h);
	c.lineTo(w * 0.1984, h * 0.8307);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5, h * 0.5533);
	c.lineTo(w, h * 0.2774);
	c.lineTo(w * 0.7967, h * 0.8307);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.2774);
	c.lineTo(w * 0.5, h * 0.5564);
	c.lineTo(w, h * 0.2774);
	c.stroke();

	c.begin();
	c.moveTo(w * 0.5, h * 0.5564);
	c.lineTo(w * 0.5, h);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.2774);
	c.lineTo(w * 0.5008, 0);
	c.lineTo(w, h * 0.2774);
	c.lineTo(w * 0.7967, h * 0.8307);
	c.lineTo(w * 0.5008, h);
	c.lineTo(w * 0.1951, h * 0.8307);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dS3Bucket.prototype.cst.S3_BUCKET, mxShapeAws3dS3Bucket);

//**********************************************************************************************************************************************************
//S3
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dS3(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dS3, mxShape);

mxShapeAws3dS3.prototype.cst = {
		S3 : 'mxgraph.aws3d.s3',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dS3.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 231.5;
	var strokeWidth2 = strokeWidth * h / 239;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dS3.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7782);
	c.lineTo(0, h * 0.3406);
	c.lineTo(w * 0.5974, 0);
	c.lineTo(w, h * 0.2218);
	c.lineTo(w, h * 0.6674);
	c.lineTo(w * 0.3991, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dS3.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dS3.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.3406);
	c.lineTo(w * 0.3991, h * 0.5548);
	c.lineTo(w * 0.3991, h);
	c.lineTo(0, h * 0.7782);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.3991, h * 0.5548);
	c.lineTo(w, h * 0.2218);
	c.lineTo(w, h * 0.6661);
	c.lineTo(w * 0.3991, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.3406);
	c.lineTo(w * 0.3991, h * 0.5548);
	c.lineTo(w, h * 0.2218);
	c.moveTo(w * 0.3991, h * 0.5548);
	c.lineTo(w * 0.3991, h);
	c.moveTo(w * 0.3991, h * 0.3335);
	c.lineTo(w * 0.2009, h * 0.448);
	c.lineTo(w * 0.2009, h * 0.8891);
	c.moveTo(w * 0.5983, h * 0.2209);
	c.lineTo(w * 0.7948, h * 0.1109);
	c.moveTo(w * 0.2022, h * 0.2218);
	c.lineTo(w * 0.5991, h * 0.4448);
	c.lineTo(w * 0.5991, h * 0.8891);
	c.moveTo(w * 0.4004, h * 0.1117);
	c.lineTo(w * 0.7978, h * 0.3335);
	c.lineTo(w * 0.7978, h * 0.7791);
	c.stroke();

	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.4773, h * 0.2155);
	c.arcTo(w * 0.0086, h * 0.0046, 0, 0, 1, w * 0.4903, h * 0.2096);
	c.arcTo(w * 0.2808, h * 0.272, 0, 0, 1, w * 0.6004, h * 0.2619);
	c.arcTo(w * 0.108, h * 0.105, 0, 0, 1, w * 0.6177, h * 0.277);
	c.arcTo(w * 0.0065, h * 0.0063, 0, 0, 1, w * 0.6099, h * 0.2879);
	c.arcTo(w * 0.1944, h * 0.1883, 0, 0, 1, w * 0.5378, h * 0.2607);
	c.arcTo(w * 0.216, h * 0.2092, 0, 0, 1, w * 0.4773, h * 0.2155);
	c.close();
	c.fill();

	c.begin();
	c.moveTo(w * 0.4687, h * 0.2138);
	c.arcTo(w * 0.1512, h * 0.1464, 0, 0, 0, w * 0.4838, h * 0.2343);
	c.arcTo(w * 0.2376, h * 0.2301, 0, 0, 0, w * 0.5529, h * 0.2774);
	c.arcTo(w * 0.1728, h * 0.1674, 0, 0, 0, w * 0.6091, h * 0.2954);
	c.lineTo(w * 0.4946, h * 0.3339);
	c.arcTo(w * 0.1944, h * 0.1883, 0, 0, 1, w * 0.4549, h * 0.3205);
	c.arcTo(w * 0.1944, h * 0.1883, 0, 0, 1, w * 0.419, h * 0.3004);
	c.arcTo(w * 0.1944, h * 0.1883, 0, 0, 1, w * 0.3965, h * 0.2795);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7782);
	c.lineTo(0, h * 0.3406);
	c.lineTo(w * 0.5974, 0);
	c.lineTo(w, h * 0.2218);
	c.lineTo(w, h * 0.6674);
	c.lineTo(w * 0.3991, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dS3.prototype.cst.S3, mxShapeAws3dS3);

//**********************************************************************************************************************************************************
//SimpleDB
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dSimpleDB(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dSimpleDB, mxShape);

mxShapeAws3dSimpleDB.prototype.cst = {
		SIMPLE_DB : 'mxgraph.aws3d.simpleDb',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dSimpleDB.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h /133;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	c.setStrokeWidth(strokeWidth);
	
	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dSimpleDB.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.626, 0);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3346);
	c.lineTo(w, h * 0.7331);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dSimpleDB.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dSimpleDB.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.126, h * 0.267);
	c.lineTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.close();
	c.moveTo(w * 0.874, h * 0.267);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3308);
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5, h);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.622, h * 0.4023);
	c.lineTo(w * 0.874, h * 0.267);
	c.lineTo(w, h * 0.3308);
	c.lineTo(w, h * 0.7331);
	c.close();
	c.fill();
	
	c.restore();

	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.setShadow(false);

	c.begin();
	c.moveTo(w * 0.1821, h * 0.182);
	c.lineTo(w * 0.4659, h * 0.0308);
	c.lineTo(w * 0.822, h * 0.2218);
	c.lineTo(w * 0.539, h * 0.3714);
	c.close();
	c.fill();
	
	c.setLineJoin('round');

	c.begin();
	c.moveTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.126, h * 0.267);
	c.lineTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.622, h * 0.4023);
	c.lineTo(w * 0.874, h * 0.267);
	c.lineTo(w * 0.874, h * 0.1316);
	c.moveTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.267);
	c.moveTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.5, h);
	c.moveTo(w, h * 0.3346);
	c.lineTo(w * 0.87, h * 0.267);
	c.moveTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.622, h * 0.4023);
	c.stroke();

	c.restore();
	c.setShadow(false);
	var fillColor = mxUtils.getValue(this.state.style, 'fillColor', '#ffffff');
	c.setStrokeColor(fillColor);
	c.setStrokeWidth(2.2 * strokeWidth);
	c.begin();
	c.moveTo(w * 0.2382, h * 0.2218);
	c.lineTo(w * 0.5415, h * 0.0602);

	c.moveTo(w * 0.3821, h * 0.0564);
	c.lineTo(w * 0.7737, h * 0.2656);
	
	c.moveTo(w * 0.2967, h * 0.0915);
	c.lineTo(w * 0.7114, h * 0.312);
	
	c.moveTo(w * 0.2209, h * 0.1316);
	c.lineTo(w * 0.6179, h * 0.3434);
	c.stroke();
	
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.626, 0);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3346);
	c.lineTo(w, h * 0.7331);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dSimpleDB.prototype.cst.SIMPLE_DB, mxShapeAws3dSimpleDB);

//**********************************************************************************************************************************************************
//SQS
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dSqs(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dSqs, mxShape);

mxShapeAws3dSqs.prototype.cst = {
		SQS : 'mxgraph.aws3d.sqs',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dSqs.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 184;
	var strokeWidth2 = strokeWidth * h / 212.75;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dSqs.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7485);
	c.lineTo(0, h * 0.584);
	c.lineTo(w * 0.1658, h * 0.1666);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w * 0.8337, h * 0.1666);
	c.lineTo(w, h * 0.584);
	c.lineTo(w, h * 0.7485);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dSqs.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dSqs.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(w * 0.1658, h * 0.1671);
	c.lineTo(w * 0.5, h * 0.334);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7485);
	c.lineTo(0, h * 0.584);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5, h * 0.3344);
	c.lineTo(w * 0.8332, h * 0.1671);
	c.lineTo(w, h * 0.584);
	c.lineTo(w, h * 0.7509);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(w * 0.6674, h * 0.0844);
	c.lineTo(w * 0.3337, h * 0.2512);
	c.lineTo(w * 0.25, h * 0.7109);
	c.lineTo(w * 0.25, h * 0.8736);

	c.moveTo(w * 0.3326, h * 0.0839);
	c.lineTo(w * 0.6674, h * 0.2512);
	c.lineTo(w * 0.75, h * 0.7053);
	c.lineTo(w * 0.75, h * 0.874);

	c.moveTo(0, h * 0.584);
	c.lineTo(w * 0.5, h * 0.8331);
	c.lineTo(w, h * 0.584);

	c.moveTo(w * 0.1658, h * 0.1671);
	c.lineTo(w * 0.5, h * 0.334);
	c.lineTo(w * 0.8332, h * 0.1671);

	c.moveTo(w * 0.5, h * 0.334);
	c.lineTo(w * 0.5, h);
	c.stroke();

	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.3337, h * 0.1511);
	c.lineTo(w * 0.4668, h * 0.0848);
	c.lineTo(w * 0.6663, h * 0.184);
	c.lineTo(w * 0.5337, h * 0.2503);
	c.close();
	c.fill();

	var fillColor = mxUtils.getValue(this.state.style, 'fillColor', '#000000');
	c.setFillColor(fillColor);

	c.begin();
	c.moveTo(w * 0.3902, h * 0.153);
	c.lineTo(w * 0.4701, h * 0.113);
	c.lineTo(w * 0.4701, h * 0.153);
	c.close();
	c.moveTo(w * 0.4402, h * 0.1784);
	c.lineTo(w * 0.5196, h * 0.1384);
	c.lineTo(w * 0.5196, h * 0.1784);
	c.close();
	c.moveTo(w * 0.4908, h * 0.2033);
	c.lineTo(w * 0.5701, h * 0.1633);
	c.lineTo(w * 0.5701, h * 0.2033);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7485);
	c.lineTo(0, h * 0.584);
	c.lineTo(w * 0.1658, h * 0.1666);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w * 0.8337, h * 0.1666);
	c.lineTo(w, h * 0.584);
	c.lineTo(w, h * 0.7485);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dSqs.prototype.cst.SQS, mxShapeAws3dSqs);

//**********************************************************************************************************************************************************
//VPC Gateway
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dVpcGateway(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dVpcGateway, mxShape);

mxShapeAws3dVpcGateway.prototype.cst = {
		VPC_GATEWAY : 'mxgraph.aws3d.vpcGateway',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dVpcGateway.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 116.7;
	var strokeWidth2 = strokeWidth * h / 102.8;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dVpcGateway.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(w * 0.5801, h * 0.5447);
	c.lineTo(w * 0.5801, h * 0.035);
	c.lineTo(w * 0.1054, 0);
	c.lineTo(0, h * 0.0691);
	c.lineTo(0, h * 0.4134);
	c.lineTo(w * 0.3188, h * 0.7247);
	c.close();
	c.fillAndStroke();

	c.restore();
	c.save();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dVpcGateway.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5801, h * 0.5447);
	c.lineTo(w * 0.5801, h * 0.035);
	c.lineTo(w * 0.3162, h * 0.2072);
	c.lineTo(w * 0.3162, h * 0.7247);
	c.close();
	c.fill();
	
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	c.begin();
	c.moveTo(w * 0.3162, h * 0.2072);
	c.lineTo(0, h * 0.0691);
	c.lineTo(0, h * 0.4134);
	c.lineTo(w * 0.3162, h * 0.7247);
	c.close();
	c.fill();

	c.restore();
	c.setShadow(false);
	c.begin();
	c.moveTo(w * 0.5801, h * 0.5447);
	c.lineTo(w * 0.5801, h * 0.035);
	c.lineTo(w * 0.3162, h * 0.2072);
	c.lineTo(w * 0.3162, h * 0.7247);
	c.close();
	c.stroke();

	c.restore();
	c.setLineJoin('round');
	c.setShadow(false);

	c.begin();
	c.moveTo(w * 0.3162, h * 0.2072);
	c.lineTo(0, h * 0.0691);
	c.lineTo(0, h * 0.4134);
	c.lineTo(w * 0.3162, h * 0.7247);
	c.close();
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	
	c.begin();
	c.moveTo(w * 0.5801, h * 0.5447);
	c.lineTo(w * 0.5801, h * 0.035);
	c.lineTo(w * 0.1054, 0);
	c.lineTo(0, h * 0.0691);
	c.lineTo(0, h * 0.4134);
	c.lineTo(w * 0.3188, h * 0.7247);
	c.close();
	c.stroke();

	c.restore();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(w, h * 0.929);
	c.lineTo(w, h * 0.5866);
	c.lineTo(w * 0.6829, h * 0.1031);
	c.lineTo(w * 0.4216, h * 0.2753);
	c.lineTo(w * 0.4216, h * 0.7928);
	c.lineTo(w * 0.8946, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dVpcGateway.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setShadow(false);
	c.setLineJoin('round');
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dVpcGateway.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	
	c.begin();
	c.moveTo(w, h * 0.929);
	c.lineTo(w, h * 0.5866);
	c.lineTo(w * 0.8946, h * 0.6537);
	c.lineTo(w * 0.8946, h);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	c.begin();
	c.moveTo(w * 0.8946, h);
	c.lineTo(w * 0.8946, h * 0.6537);
	c.lineTo(w * 0.4216, h * 0.2753);
	c.lineTo(w * 0.4216, h * 0.7928);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(w, h * 0.929);
	c.lineTo(w, h * 0.5866);
	c.lineTo(w * 0.8946, h * 0.6537);
	c.lineTo(w * 0.8946, h);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.8946, h);
	c.lineTo(w * 0.8946, h * 0.6537);
	c.lineTo(w * 0.4216, h * 0.2753);
	c.lineTo(w * 0.4216, h * 0.7928);
	c.close();
	c.stroke();
	
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(w, h * 0.929);
	c.lineTo(w, h * 0.5866);
	c.lineTo(w * 0.6829, h * 0.1031);
	c.lineTo(w * 0.4216, h * 0.2753);
	c.lineTo(w * 0.4216, h * 0.7928);
	c.lineTo(w * 0.8946, h);
	c.close();
	c.stroke();

	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.5587, h * 0.7743);
	c.lineTo(w * 0.5587, h * 0.6274);
	c.lineTo(w * 0.5775, h * 0.6342);
	c.lineTo(w * 0.5775, h * 0.57);
	c.arcTo(w * 0.0428, h * 0.0486, 0, 0, 1, w * 0.6058, h * 0.5253);
	c.arcTo(w * 0.0686, h * 0.0778, 0, 0, 1, w * 0.6564, h * 0.5447);
	c.arcTo(w * 0.0857, h * 0.0973, 0, 0, 1, w * 0.6847, h * 0.607);
	c.lineTo(w * 0.6847, h * 0.6877);
	c.lineTo(w * 0.7001, h * 0.6946);
	c.lineTo(w * 0.7001, h * 0.8405);
	c.close();
	c.moveTo(w * 0.6564, h * 0.6741);
	c.lineTo(w * 0.6564, h * 0.6177);
	c.arcTo(w * 0.06, h * 0.0681, 0, 0, 0, w * 0.6392, h * 0.57);
	c.arcTo(w * 0.0343, h * 0.0389, 0, 0, 0, w * 0.6195, h * 0.5574);
	c.arcTo(w * 0.0111, h * 0.0126, 0, 0, 0, w * 0.6058, h * 0.5691);
	c.lineTo(w * 0.6058, h * 0.6498);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxShapeAws3dVpcGateway.prototype.cst.VPC_GATEWAY, mxShapeAws3dVpcGateway);

//**********************************************************************************************************************************************************
//Web Server
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dWebServer(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dWebServer, mxShape);

mxShapeAws3dWebServer.prototype.cst = {
		WEB_SERVER : 'mxgraph.aws3d.webServer',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dWebServer.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h / 106;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dWebServer.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.6651);
	c.lineTo(0, h * 0.3349);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.3349);
	c.lineTo(w, h * 0.6651);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dWebServer.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dWebServer.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.3349);
	c.lineTo(w * 0.5, h * 0.6651);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.6651);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5, h * 0.6651);
	c.lineTo(w, h * 0.3349);
	c.lineTo(w, h * 0.6651);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.3349);
	c.lineTo(w * 0.5, h * 0.6651);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.6651);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.5, h * 0.6651);
	c.lineTo(w, h * 0.3349);
	c.lineTo(w, h * 0.6651);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
	
	c.setLineJoin('miter');
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.374, h * 0.5189);
	c.arcTo(w * 0.0325, h * 0.0236, 0, 0, 1, w * 0.374, h * 0.4858);
	c.lineTo(w * 0.4797, h * 0.4151);
	c.arcTo(w * 0.0325, h * 0.0236, 0, 0, 1, w * 0.5203, h * 0.4151);
	c.lineTo(w * 0.626, h * 0.4858);
	c.arcTo(w * 0.0325, h * 0.0236, 0, 0, 1, w * 0.626, h * 0.516);
	c.lineTo(w * 0.5203, h * 0.5868);
	c.arcTo(w * 0.0325, h * 0.0236, 0, 0, 1, w * 0.4797, h * 0.5868);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.6651);
	c.lineTo(0, h * 0.3349);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.3349);
	c.lineTo(w, h * 0.6651);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dWebServer.prototype.cst.WEB_SERVER, mxShapeAws3dWebServer);

//**********************************************************************************************************************************************************
//DynamoDB
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dDynamoDB(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dDynamoDB, mxShape);

mxShapeAws3dDynamoDB.prototype.cst = {
		DYNAMO_DB : 'mxgraph.aws3d.dynamoDb',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dDynamoDB.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 181.5;
	var strokeWidth2 = strokeWidth * h / 210;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dDynamoDB.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.8333);
	c.lineTo(0, h * 0.1667);
	c.lineTo(w * 0.3333, h * 0.0014);
	c.lineTo(w * 0.4986, h * 0.1667);
	c.lineTo(w * 0.6639, 0);
	c.lineTo(w, h * 0.169);
	c.lineTo(w, h * 0.8333);
	c.lineTo(w * 0.6667, h);
	c.lineTo(w * 0.5014, h * 0.9162);
	c.lineTo(w * 0.3333, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dDynamoDB.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dDynamoDB.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(w * 0.168, h * 0.3333);
	c.lineTo(0, h * 0.3333);
	c.lineTo(w * 0.3333, h * 0.5);
	c.lineTo(w * 0.3333, h);
	c.lineTo(0, h * 0.8333);
	c.lineTo(0, h * 0.1714);
	c.close();
	c.moveTo(w * 0.4986, h * 0.1667);
	c.lineTo(w * 0.6667, 0);
	c.lineTo(w, h * 0.169);
	c.lineTo(w * 0.832, h * 0.3348);//
	c.lineTo(w, h * 0.3333);
	c.lineTo(w * 0.6667, h * 0.5);
	c.lineTo(w * 0.5014, h * 0.5);
	c.lineTo(w * 0.832, h * 0.3348);
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.3333, h * 0.5);
	c.lineTo(w * 0.4986, h * 0.5);
	c.lineTo(w * 0.4986, h * 0.9162);
	c.lineTo(w * 0.3333, h);
	c.close();
	c.moveTo(w * 0.6667, h);
	c.lineTo(w * 0.6667, h * 0.5);
	c.lineTo(w, h * 0.3333);
	c.lineTo(w * 0.832, h * 0.3348);
	c.lineTo(w, h * 0.169);
	c.lineTo(w, h * 0.831);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(w * 0.168, h * 0.3333);
	c.lineTo(0, h * 0.3333);
	c.lineTo(w * 0.3333, h * 0.5);
	c.lineTo(w * 0.3333, h);
	c.lineTo(0, h * 0.8333);
	c.lineTo(0, h * 0.1714);
	c.close();
	c.moveTo(w * 0.4986, h * 0.1667);
	c.lineTo(w * 0.6667, 0);
	c.lineTo(w, h * 0.169);
	c.lineTo(w * 0.832, h * 0.3348);
	c.lineTo(w, h * 0.3333);
	c.lineTo(w * 0.6667, h * 0.5);
	c.lineTo(w * 0.5014, h * 0.5);
	c.lineTo(w * 0.832, h * 0.3348);
	c.close();
	c.moveTo(w * 0.3333, h * 0.5);
	c.lineTo(w * 0.4986, h * 0.5);
	c.lineTo(w * 0.4986, h * 0.9162);
	c.lineTo(w * 0.3333, h);
	c.close();
	c.moveTo(w * 0.6667, h);
	c.lineTo(w * 0.6667, h * 0.5);
	c.lineTo(w, h * 0.3333);
	c.lineTo(w, h * 0.831);
	c.close();
	c.moveTo(w * 0.168, h * 0.3333);
	c.lineTo(w * 0.5, h * 0.1667);
	c.moveTo(w * 0.168, h * 0.3333);
	c.lineTo(w * 0.5014, h * 0.5);
	c.stroke();

	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.4876, h * 0.2262);
	c.arcTo(w * 0.303, h * 0.2619, 0, 0, 1, w * 0.5647, h * 0.25);
	c.arcTo(w * 0.4407, h * 0.381, 0, 0, 1, w * 0.6419, h * 0.2905);
	c.arcTo(w * 0.303, h * 0.2619, 0, 0, 1, w * 0.6799, h * 0.32);
	c.arcTo(w * 0.0132, h * 0.0076, 0, 0, 1, w * 0.6634, h * 0.3314);
	c.arcTo(w * 0.303, h * 0.2619, 0, 0, 1, w * 0.5978, h * 0.3119);
	c.arcTo(w * 0.4408, h * 0.381, 0, 0, 1, w * 0.508, h * 0.2667);
	c.arcTo(w * 0.303, h * 0.2619, 0, 0, 1, w * 0.4711, h * 0.2343);
	c.arcTo(w * 0.0132, h * 0.0076, 0, 0, 1, w * 0.4876, h * 0.2262);
	c.close();
	c.fill();

	c.begin();
	c.moveTo(w * 0.5124, h * 0.4143);
	c.arcTo(w * 0.1102, h * 0.0952, 0, 0, 1, w * 0.4683, h * 0.4095);
	c.arcTo(w * 0.4408, h * 0.381, 0, 0, 1, w * 0.3829, h * 0.3757);
	c.arcTo(w * 0.4408, h * 0.381, 0, 0, 1, w * 0.3196, h * 0.3371);
	c.arcTo(w * 0.0661, h * 0.0357, 0, 0, 1, w * 0.3058, h * 0.3081);
	c.lineTo(w * 0.4612, h * 0.2333);
	c.arcTo(w * 0.0661, h * 0.0476, 0, 0, 0, w * 0.4744, h * 0.2548);
	c.arcTo(w * 0.3306, h * 0.2857, 0, 0, 0, w * 0.53, h * 0.2905);
	c.arcTo(w * 0.4408, h * 0.381, 0, 0, 0, w * 0.6198, h * 0.3295);
	c.arcTo(w * 0.1102, h * 0.0952, 0, 0, 0, w * 0.665, h * 0.3367);
	c.close();
	c.moveTo(w * 0.5052, h * 0.3714);
	c.arcTo(w * 0.0275, h * 0.019, 0, 0, 1, w * 0.5135, h * 0.3581);
	c.arcTo(w * 0.0275, h * 0.0238, 0, 0, 1, w * 0.5344, h * 0.3571);
	c.lineTo(w * 0.5405, h * 0.3471);
	c.arcTo(w * 0.0275, h * 0.0143, 0, 0, 1, w * 0.5278, h * 0.3381);
	c.arcTo(w * 0.022, h * 0.0119, 0, 0, 1, w * 0.5372, h * 0.3271);
	c.lineTo(w * 0.5306, h * 0.3186);
	c.arcTo(w * 0.0331, h * 0.0286, 0, 0, 1, w * 0.5041, h * 0.3143);
	c.arcTo(w * 0.0275, h * 0.0143, 0, 0, 1, w * 0.4975, h * 0.3029);
	c.lineTo(w * 0.4777, h * 0.2995);
	c.arcTo(w * 0.0331, h * 0.0286, 0, 0, 1, w * 0.4628, h * 0.3033);
	c.arcTo(w * 0.0331, h * 0.0286, 0, 0, 1, w * 0.4408, h * 0.2967);
	c.lineTo(w * 0.4187, h * 0.3);
	c.arcTo(w * 0.011, h * 0.0081, 0, 0, 1, w * 0.4132, h * 0.3124);
	c.arcTo(w * 0.0386, h * 0.0333, 0, 0, 1, w * 0.395, h * 0.3129);
	c.lineTo(w * 0.3873, h * 0.3224);
	c.arcTo(w * 0.0165, h * 0.0143, 0, 0, 1, w * 0.3994, h * 0.3333);
	c.arcTo(w * 0.0138, h * 0.0119, 0, 0, 1, w * 0.3901, h * 0.3433);
	c.lineTo(w * 0.3994, h * 0.3514);
	c.arcTo(w * 0.0331, h * 0.0286, 0, 0, 1, w * 0.4215, h * 0.3548);
	c.arcTo(w * 0.0165, h * 0.0119, 0, 0, 1, w * 0.4298, h * 0.3667);
	c.lineTo(w * 0.449, h * 0.3714);
	c.arcTo(w * 0.0331, h * 0.0286, 0, 0, 1, w * 0.4711, h * 0.3657);
	c.arcTo(w * 0.0331, h * 0.0286, 0, 0, 1, w * 0.4887, h * 0.3724);
	c.close();
	c.moveTo(w * 0.4986, h * 0.351);
	c.arcTo(w * 0.0441, h * 0.0381, 0, 0, 1, w * 0.4804, h * 0.3552);
	c.arcTo(w * 0.1102, h * 0.0952, 0, 0, 1, w * 0.443, h * 0.349);
	c.lineTo(w * 0.4413, h * 0.3529);
	c.lineTo(w * 0.4242, h * 0.3371);
	c.arcTo(w * 0.1102, h * 0.0952, 0, 0, 0, w * 0.4545, h * 0.3462);
	c.arcTo(w * 0.1102, h * 0.0952, 0, 0, 0, w * 0.4793, h * 0.3476);
	c.arcTo(w * 0.0441, h * 0.0381, 0, 0, 0, w * 0.4986, h * 0.3448);
	c.close();
	c.moveTo(w * 0.503, h * 0.3349);
	c.arcTo(w * 0.1102, h * 0.0952, 0, 0, 0, w * 0.4766, h * 0.3233);
	c.arcTo(w * 0.0826, h * 0.0714, 0, 0, 0, w * 0.4529, h * 0.32);
	c.arcTo(w * 0.0551, h * 0.0476, 0, 0, 0, w * 0.4325, h * 0.3238);
	c.lineTo(w * 0.427, h * 0.3195);
	c.arcTo(w * 0.0826, h * 0.0714, 0, 0, 1, w * 0.4556, h * 0.3157);
	c.arcTo(w * 0.0826, h * 0.0714, 0, 0, 1, w * 0.4851, h * 0.3232);
	c.lineTo(w * 0.4876, h * 0.3181);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.8333);
	c.lineTo(0, h * 0.1667);
	c.lineTo(w * 0.3333, h * 0.0014);
	c.lineTo(w * 0.4986, h * 0.1667);
	c.lineTo(w * 0.6639, 0);
	c.lineTo(w, h * 0.169);
	c.lineTo(w, h * 0.8333);
	c.lineTo(w * 0.6667, h);
	c.lineTo(w * 0.5014, h * 0.9162);
	c.lineTo(w * 0.3333, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dDynamoDB.prototype.cst.DYNAMO_DB, mxShapeAws3dDynamoDB);

//**********************************************************************************************************************************************************
//Elastic MapReduce
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dElasticMapReduce(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dElasticMapReduce, mxShape);

mxShapeAws3dElasticMapReduce.prototype.cst = {
		ELASTIC_MAP_REDUCE : 'mxgraph.aws3d.elasticMapReduce',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dElasticMapReduce.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h /133;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	c.setStrokeWidth(strokeWidth);
	
	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dElasticMapReduce.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.626, 0);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3346);
	c.lineTo(w, h * 0.7331);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dElasticMapReduce.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dDynamoDB.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.126, h * 0.267);
	c.lineTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.close();
	c.moveTo(w * 0.874, h * 0.267);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3308);
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5, h);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.622, h * 0.4023);
	c.lineTo(w * 0.874, h * 0.267);
	c.lineTo(w, h * 0.3308);
	c.lineTo(w, h * 0.7331);
	c.close();
	c.fill();
	
	c.restore();

	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.setShadow(false);

	c.begin();
	c.moveTo(w * 0.3336, h * 0.1789);
	c.arcTo(w * 0.0328, h * 0.0301, 0, 0, 1, w * 0.359, h * 0.1789);
	c.lineTo(w * 0.4001, h * 0.2015);
	c.arcTo(w * 0.0074, h * 0.0068, 0, 0, 1, w * 0.4008, h * 0.2135);
	c.lineTo(w * 0.3574, h * 0.2368);
	c.arcTo(w * 0.0328, h * 0.0301, 0, 0, 1, w * 0.3352, h * 0.2368);
	c.lineTo(w * 0.2934, h * 0.2143);
	c.arcTo(w * 0.0074, h * 0.0068, 0, 0, 1, w * 0.2934, h * 0.2015);
	c.close();
	c.moveTo(w * 0.3705, h * 0.1729);
	c.arcTo(w * 0.0074, h * 0.0068, 0, 0, 1, w * 0.3705, h * 0.1602);
	c.lineTo(w * 0.4139, h * 0.1368);
	c.arcTo(w * 0.0328, h * 0.0301, 0, 0, 1, w * 0.4336, h * 0.1368);
	c.lineTo(w * 0.4811, h * 0.1617);
	c.arcTo(w * 0.0074, h * 0.0068, 0, 0, 1, w * 0.4811, h * 0.1708);
	c.lineTo(w * 0.4328, h * 0.1955);
	c.arcTo(w * 0.0328, h * 0.0301, 0, 0, 1, w * 0.4156, h * 0.1955);
	c.close();
	c.moveTo(w * 0.4467, h * 0.1308);
	c.arcTo(w * 0.0074, h * 0.0068, 0, 0, 1, w * 0.4467, h * 0.1203);
	c.lineTo(w * 0.491, h * 0.0962);
	c.arcTo(w * 0.0328, h * 0.0301, 0, 0, 1, w * 0.5123, h * 0.0962);
	c.lineTo(w * 0.559, h * 0.1203);
	c.arcTo(w * 0.0074, h * 0.0068, 0, 0, 1, w * 0.559, h * 0.1293);
	c.lineTo(w * 0.5123, h * 0.1549);
	c.arcTo(w * 0.0328, h * 0.0301, 0, 0, 1, w * 0.4918, h * 0.1549);
	c.close();
	c.moveTo(w * 0.568, h * 0.1383);
	c.arcTo(w * 0.0328, h * 0.0301, 0, 0, 1, w * 0.5918, h * 0.1383);
	c.lineTo(w * 0.6361, h * 0.1624);
	c.arcTo(w * 0.0074, h * 0.0068, 0, 0, 1, w * 0.6366, h * 0.1714);
	c.lineTo(w * 0.5885, h * 0.1955);
	c.arcTo(w * 0.0328, h * 0.0301, 0, 0, 1, w * 0.568, h * 0.1955);
	c.lineTo(w * 0.523, h * 0.1714);
	c.arcTo(w * 0.0074, h * 0.0068, 0, 0, 1, w * 0.523, h * 0.1616);
	c.close();
	c.moveTo(w * 0.6451, h * 0.1789);
	c.arcTo(w * 0.0328, h * 0.0301, 0, 0, 1, w * 0.6697, h * 0.1789);
	c.lineTo(w * 0.7123, h * 0.2023);
	c.arcTo(w * 0.0074, h * 0.0068, 0, 0, 1, w * 0.7123, h * 0.2128);
	c.lineTo(w * 0.6664, h * 0.2376);
	c.arcTo(w * 0.0328, h * 0.0301, 0, 0, 1, w * 0.6492, h * 0.2376);
	c.lineTo(w * 0.6016, h * 0.2135);
	c.arcTo(w * 0.0074, h * 0.0068, 0, 0, 1, w * 0.6016, h * 0.2023);
	c.close();
	c.moveTo(w * 0.6369, h * 0.2451);
	c.arcTo(w * 0.0074, h * 0.0068, 0, 0, 1, w * 0.6369, h * 0.2526);
	c.lineTo(w * 0.5172, h * 0.3173);
	c.arcTo(w * 0.0328, h * 0.0301, 0, 0, 1, w * 0.4893, h * 0.3173);
	c.lineTo(w * 0.3697, h * 0.2541);
	c.arcTo(w * 0.0074, h * 0.0068, 0, 0, 1, w * 0.3697, h * 0.2436);
	c.lineTo(w * 0.4918, h * 0.1782);
	c.arcTo(w * 0.0328, h * 0.0301, 0, 0, 1, w * 0.5131, h * 0.1782);
	c.close();
	c.fill();

	c.moveTo(w * 0., h * 0.);
	c.lineTo(w * 0., h * 0.);
	c.arcTo(w * 0., h * 0., 0, 0, 1, w * 0., h * 0.);
	
	c.setLineJoin('round');

	c.begin();
	c.moveTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.126, h * 0.267);
	c.lineTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.622, h * 0.4023);
	c.lineTo(w * 0.874, h * 0.267);
	c.lineTo(w * 0.874, h * 0.1316);
	c.moveTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.267);
	c.moveTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.5, h);
	c.moveTo(w, h * 0.3346);
	c.lineTo(w * 0.87, h * 0.267);
	c.moveTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.622, h * 0.4023);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.626, 0);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3346);
	c.lineTo(w, h * 0.7331);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dElasticMapReduce.prototype.cst.ELASTIC_MAP_REDUCE, mxShapeAws3dElasticMapReduce);

//**********************************************************************************************************************************************************
//RDS Slave
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dRdsSlave(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dRdsSlave, mxShape);

mxShapeAws3dRdsSlave.prototype.cst = {
		RDS_SLAVE : 'mxgraph.aws3d.rdsSlave'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dRdsSlave.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h /133;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	c.setStrokeWidth(strokeWidth);
	
	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dRdsSlave.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.626, 0);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3346);
	c.lineTo(w, h * 0.7331);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dRdsSlave.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	c.setAlpha('0.1');
	
	c.begin();
	c.moveTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.126, h * 0.267);
	c.lineTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.close();
	c.moveTo(w * 0.874, h * 0.267);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3308);
	c.fill();

	c.setAlpha('0.3');
	c.begin();
	c.moveTo(w * 0.5, h);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.622, h * 0.4023);
	c.lineTo(w * 0.874, h * 0.267);
	c.lineTo(w, h * 0.3308);
	c.lineTo(w, h * 0.7331);
	c.close();
	c.fill();
	
	c.restore();

	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.setShadow(false);

	c.begin();
	c.moveTo(w * 0.2457, h * 0.2137);
	c.lineTo(w * 0.5393, h * 0.0593);
	c.lineTo(w * 0.6875, h * 0.1377);
	c.arcTo(w * 0.0871, h * 0.0799, 0, 0, 1, w * 0.7137, h * 0.1625);
	c.arcTo(w * 0.0348, h * 0.032, 0, 0, 1, w * 0.7076, h * 0.1968);
	c.arcTo(w * 0.1743, h * 0.1599, 0, 0, 1, w * 0.6597, h * 0.2249);
	c.arcTo(w * 0.1307, h * 0.1199, 0, 0, 1, w * 0.5943, h * 0.232);
	c.arcTo(w * 0.1307, h * 0.1199, 0, 0, 1, w * 0.5542, h * 0.2225);
	c.arcTo(w * 0.0871, h * 0.0799, 0, 0, 1, w * 0.5673, h * 0.2353);
	c.arcTo(w * 0.0261, h * 0.024, 0, 0, 1, w * 0.5611, h * 0.2729);
	c.lineTo(w * 0.4889, h * 0.316);
	c.arcTo(w * 0.0261, h * 0.024, 0, 0, 0, w * 0.4766, h * 0.3352);
	c.lineTo(w * 0.4052, h * 0.2992);
	c.arcTo(w * 0.0173, h * 0.0159, 0, 0, 1, w * 0.4121, h * 0.2841);
	c.lineTo(w * 0.4914, h * 0.2368);
	c.arcTo(w * 0.0218, h * 0.02, 0, 0, 0, w * 0.4897, h * 0.2129);
	c.lineTo(w * 0.4409, h * 0.1857);
	c.lineTo(w * 0.3145, h * 0.2529);
	c.close();
	c.moveTo(w * 0.4801, h * 0.1633);
	c.lineTo(w * 0.5263, h * 0.1865);
	c.arcTo(w * 0.0871, h * 0.0799, 0, 0, 0, w * 0.583, h * 0.1905);
	c.arcTo(w * 0.1307, h * 0.1199, 0, 0, 0, w * 0.6196, h * 0.1721);
	c.arcTo(w * 0.0261, h * 0.024, 0, 0, 0, w * 0.6117, h * 0.1441);
	c.lineTo(w * 0.5655, h * 0.1193);
	c.fill();

	c.setLineJoin('round');

	c.begin();
	c.moveTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.126, h * 0.267);
	c.lineTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.622, h * 0.4023);
	c.lineTo(w * 0.874, h * 0.267);
	c.lineTo(w * 0.874, h * 0.1316);
	c.moveTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.267);
	c.moveTo(w * 0.5, h * 0.6015);
	c.lineTo(w * 0.5, h);
	c.moveTo(w, h * 0.3346);
	c.lineTo(w * 0.87, h * 0.267);
	c.moveTo(w * 0.378, h * 0.4023);
	c.lineTo(w * 0.622, h * 0.4023);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.7331);
	c.lineTo(0, h * 0.3346);
	c.lineTo(w * 0.126, h * 0.1316);
	c.lineTo(w * 0.374, 0);
	c.lineTo(w * 0.626, 0);
	c.lineTo(w * 0.874, h * 0.1316);
	c.lineTo(w, h * 0.3346);
	c.lineTo(w, h * 0.7331);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dRdsSlave.prototype.cst.RDS_SLAVE, mxShapeAws3dRdsSlave);

//**********************************************************************************************************************************************************
//AMI
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dAMI2(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dAMI2, mxShape);

mxShapeAws3dAMI2.prototype.cst = {
		AMI_2 : 'mxgraph.aws3d.ami2',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dAMI2.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	var strokeWidth1 = strokeWidth * w / 92;
	var strokeWidth2 = strokeWidth * h / 60;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	
	c.setStrokeWidth(strokeWidth);
	c.setShadow(false);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if (isShadow == 1)
	{
		c.setShadow(true);
	}

	c.begin();
	c.moveTo(0, h * 0.572);
	c.lineTo(w * 0.0865, h * 0.284);
	c.lineTo(w * 0.4203, 0);
	c.lineTo(w * 0.5865, 0);
	c.lineTo(w * 0.919, h * 0.286);
	c.lineTo(w, h * 0.566);
	c.lineTo(w * 0.5027, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dAMI2.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.566);
	c.lineTo(w * 0.0892, h * 0.282);
	c.lineTo(w * 0.0878, h * 0.426);
	c.lineTo(w * 0.4216, h * 0.712);
	c.lineTo(w * 0.5865, h * 0.712);
	c.lineTo(w * 0.5027, h);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5027, h);
	c.lineTo(w * 0.5865, h * 0.712);
	c.lineTo(w * 0.9176, h * 0.43);
	c.lineTo(w, h * 0.566);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.566);
	c.lineTo(w * 0.0892, h * 0.282);
	c.lineTo(w * 0.0878, h * 0.426);
	c.lineTo(w * 0.4216, h * 0.712);
	c.lineTo(w * 0.5865, h * 0.712);
	c.lineTo(w * 0.5027, h);
	c.close();
	c.moveTo(w * 0.5027, h);
	c.lineTo(w * 0.5865, h * 0.712);
	c.lineTo(w * 0.9176, h * 0.43);
	c.lineTo(w, h * 0.566);
	c.close();
	c.moveTo(0, h * 0.572);
	c.lineTo(w * 0.0892, h * 0.422);
	c.moveTo(w * 0.5027, h);
	c.lineTo(w * 0.4189, h * 0.708);
	c.moveTo(w * 0.9176, h * 0.43);
	c.lineTo(w * 0.9176, h * 0.29);
	c.stroke();
	
	c.setStrokeWidth(2 * strokeWidth);
	c.setLineJoin('round');
	c.begin();
	c.moveTo(w * 0.2095, h * 0.376);
	c.lineTo(w * 0.527, h * 0.104);
	c.lineTo(w * 0.6338, h * 0.194);
	c.lineTo(w * 0.3149, h * 0.468);
	c.close();
	c.moveTo(w * 0.3716, h * 0.518);
	c.lineTo(w * 0.6892, h * 0.246);
	c.lineTo(w * 0.796, h * 0.336);
	c.lineTo(w * 0.477, h * 0.61);
	c.close();
	c.moveTo(w * 0.3108, h * 0.282);
	c.lineTo(w * 0.4257, h * 0.38);
	c.moveTo(w * 0.4189, h * 0.194);
	c.lineTo(w * 0.5297, h * 0.288);
	c.moveTo(w * 0.5838, h * 0.338);
	c.lineTo(w * 0.6892, h * 0.426);
	c.moveTo(w * 0.4757, h * 0.426);
	c.lineTo(w * 0.5838, h * 0.518);
	c.stroke();

	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.572);
	c.lineTo(w * 0.0865, h * 0.284);
	c.lineTo(w * 0.4203, 0);
	c.lineTo(w * 0.5865, 0);
	c.lineTo(w * 0.919, h * 0.286);
	c.lineTo(w, h * 0.566);
	c.lineTo(w * 0.5027, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dAMI2.prototype.cst.AMI_2, mxShapeAws3dAMI2);

//**********************************************************************************************************************************************************
//EBS
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dEbs(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dEbs, mxShape);

mxShapeAws3dEbs.prototype.cst = {
		EBS : 'mxgraph.aws3d.ebs',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dEbs.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 92;
	var strokeWidth2 = strokeWidth * h / 60;
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	
	c.setStrokeWidth(strokeWidth);
	c.setShadow(false);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if(isShadow == 1)
	{
		c.setShadow(true);
	}
	
	c.begin();
	c.moveTo(0, h * 0.5276);
	c.lineTo(0, h * 0.4188);
	c.lineTo(w * 0.071, h * 0.2898);
	c.lineTo(w * 0.4033, 0);
	c.lineTo(w * 0.9301, h * 0.464);
	c.lineTo(w, h * 0.5863);
	c.lineTo(w, h * 0.7035);
	c.lineTo(w * 0.6667, h);
	c.lineTo(w * 0.5355, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dEbs.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(w * 0.071, h * 0.2948);
	c.lineTo(w * 0.6011, h * 0.7621);
	c.lineTo(w * 0.6667, h);
	c.lineTo(w * 0.5355, h);
	c.lineTo(0, h * 0.5276);
	c.lineTo(0, h * 0.4137);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.6011, h * 0.7655);
	c.lineTo(w * 0.9344, h * 0.4724);
	c.lineTo(w, h * 0.7035);
	c.lineTo(w * 0.6667, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(w * 0.071, h * 0.2948);
	c.lineTo(w * 0.6011, h * 0.7621);
	c.lineTo(w * 0.6667, h);
	c.lineTo(w * 0.5355, h);
	c.lineTo(0, h * 0.5276);
	c.lineTo(0, h * 0.4137);
	c.close();
	c.moveTo(w * 0.6011, h * 0.7655);
	c.lineTo(w * 0.9344, h * 0.4724);
	c.lineTo(w, h * 0.7035);
	c.lineTo(w * 0.6667, h);
	c.close();
	c.moveTo(w * 0.0033, h * 0.5276);
	c.lineTo(w * 0.071, h * 0.2898);
	c.moveTo(w * 0.5325, h * 0.9976);
	c.lineTo(w * 0.603, h * 0.7593);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.5276);
	c.lineTo(0, h * 0.4188);
	c.lineTo(w * 0.071, h * 0.2898);
	c.lineTo(w * 0.4033, 0);
	c.lineTo(w * 0.9301, h * 0.464);
	c.lineTo(w, h * 0.5863);
	c.lineTo(w, h * 0.7035);
	c.lineTo(w * 0.6667, h);
	c.lineTo(w * 0.5355, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dEbs.prototype.cst.EBS, mxShapeAws3dEbs);

//**********************************************************************************************************************************************************
//Oracle  Server
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dOracleServer(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dOracleServer, mxShape);

mxShapeAws3dOracleServer.prototype.cst = {
		ORACLE_SERVER : 'mxgraph.aws3d.oracleServer'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dOracleServer.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 123;
	var strokeWidth2 = strokeWidth * h /133;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	c.setStrokeWidth(strokeWidth);
	
	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dOracleServer.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7464);
	c.lineTo(0, h * 0.25);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.25);
	c.lineTo(w, h * 0.7464);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dOracleServer.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	c.setAlpha('0.1');
	
	c.begin();
	c.moveTo(0, h * 0.7464);
	c.lineTo(0, h * 0.25);
	c.lineTo(w * 0.5, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();

	c.setAlpha('0.3');
	c.begin();
	c.moveTo(w * 0.5, h * 0.5);
	c.lineTo(w, h * 0.25);
	c.lineTo(w, h * 0.7464);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.setFillColor('#ff0000');

	c.begin();
	c.moveTo(0, h * 0.5866);
	c.lineTo(w * 0.5, h * 0.8359);
	c.lineTo(w, h * 0.5866);
	c.lineTo(w, h * 0.6986);
	c.lineTo(w * 0.5, h * 0.9486);
	c.lineTo(0, h * 0.6986);
	c.fill();

	c.setStrokeWidth(0.5 * strokeWidth);
	c.setStrokeColor('#ffffff');
	c.setFillColor('#ffffff');
	
	c.begin();
	c.moveTo(0, h * 0.5866);
	c.lineTo(w * 0.5, h * 0.8359);
	c.lineTo(w, h * 0.5866);
	c.moveTo(w, h * 0.6986);
	c.lineTo(w * 0.5, h * 0.9486);
	c.lineTo(0, h * 0.6986);
	c.stroke();
	
	c.begin();
	c.moveTo(w * 0.0813, h * 0.7113);
	c.arcTo(w * 0.0569, h * 0.0493, 0, 0, 1, w * 0.065, h * 0.6831);
	c.arcTo(w * 0.065, h * 0.0563, 0, 0, 1, w * 0.065, h * 0.6613);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 1, w * 0.0797, h * 0.6549);
	c.lineTo(w * 0.122, h * 0.6754);
	c.arcTo(w * 0.065, h * 0.0563, 0, 0, 1, w * 0.1358, h * 0.6937);
	c.arcTo(w * 0.065, h * 0.0563, 0, 0, 1, w * 0.139, h * 0.7232);
	c.arcTo(w * 0.0179, h * 0.0155, 0, 0, 1, w * 0.1187, h * 0.7296);
	c.close();
	c.moveTo(w * 0.1163, h * 0.7183);
	c.arcTo(w * 0.0089, h * 0.0077, 0, 0, 0, w * 0.1285, h * 0.7148);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 0, w * 0.1293, h * 0.7021);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 0, w * 0.1179, h * 0.6831);
	c.lineTo(w * 0.087, h * 0.6676);
	c.arcTo(w * 0.0081, h * 0.007, 0, 0, 0, w * 0.0764, h * 0.6697);
	c.arcTo(w * 0.0325, h * 0.0352, 0, 0, 0, w * 0.078, h * 0.6937);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 0, w * 0.087, h * 0.7035);
	c.close();
	c.moveTo(w * 0.1439, h * 0.743);
	c.lineTo(w * 0.1439, h * 0.6866);
	c.lineTo(w * 0.1846, h * 0.707);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.1967, h * 0.7183);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.2, h * 0.738);
	c.arcTo(w * 0.0138, h * 0.0155, 0, 0, 1, w * 0.1813, h * 0.743);
	c.lineTo(w * 0.1992, h * 0.769);
	c.lineTo(w * 0.187, h * 0.7641);
	c.lineTo(w * 0.1577, h * 0.7218);
	c.lineTo(w * 0.1854, h * 0.7345);
	c.arcTo(w * 0.0041, h * 0.0035, 0, 0, 0, w * 0.1911, h * 0.7317);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 0, w * 0.1894, h * 0.7225);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 0, w * 0.1821, h * 0.7155);
	c.lineTo(w * 0.1528, h * 0.7007);
	c.lineTo(w * 0.1528, h * 0.7472);
	c.close();
	c.moveTo(w * 0.2008, h * 0.7711);
	c.lineTo(w * 0.2293, h * 0.7338);
	c.arcTo(w * 0.0065, h * 0.0056, 0, 0, 1, w * 0.2382, h * 0.7324);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.2431, h * 0.7415);
	c.lineTo(w * 0.2699, h * 0.8035);
	c.lineTo(w * 0.2602, h * 0.8007);
	c.lineTo(w * 0.252, h * 0.7859);
	c.lineTo(w * 0.2293, h * 0.7754);
	c.lineTo(w * 0.2244, h * 0.7634);
	c.lineTo(w * 0.248, h * 0.7739);
	c.lineTo(w * 0.235, h * 0.7444);
	c.lineTo(w * 0.2122, h * 0.7768);
	c.close();
	c.moveTo(w * 0.3244, h * 0.8225);
	c.lineTo(w * 0.3171, h * 0.8289);
	c.lineTo(w * 0.2854, h * 0.8127);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.2724, h * 0.7986);
	c.arcTo(w * 0.0569, h * 0.0493, 0, 0, 1, w * 0.265, h * 0.7746);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.2683, h * 0.762);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 1, w * 0.2829, h * 0.757);
	c.lineTo(w * 0.3228, h * 0.7761);
	c.lineTo(w * 0.3179, h * 0.7831);
	c.lineTo(w * 0.2878, h * 0.7683);
	c.arcTo(w * 0.0081, h * 0.007, 0, 0, 0, w * 0.2789, h * 0.7697);
	c.arcTo(w * 0.0244, h * 0.0211, 0, 0, 0, w * 0.2748, h * 0.7831);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 0, w * 0.2878, h * 0.8042);
	c.close();
	c.moveTo(w * 0.3276, h * 0.7789);
	c.lineTo(w * 0.3366, h * 0.7831);
	c.lineTo(w * 0.3366, h * 0.8289);
	c.lineTo(w * 0.3805, h * 0.8507);
	c.lineTo(w * 0.3748, h * 0.857);
	c.lineTo(w * 0.3317, h * 0.8359);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 1, w * 0.3276, h * 0.8275);
	c.close();
	c.moveTo(w * 0.435, h * 0.8775);
	c.lineTo(w * 0.4325, h * 0.8866);
	c.lineTo(w * 0.3959, h * 0.8683);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.3862, h * 0.8563);
	c.arcTo(w * 0.0528, h * 0.0458, 0, 0, 1, w * 0.3805, h * 0.8183);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 1, w * 0.3951, h * 0.8134);
	c.lineTo(w * 0.435, h * 0.8324);
	c.lineTo(w * 0.4285, h * 0.838);
	c.lineTo(w * 0.4008, h * 0.8246);
	c.arcTo(w * 0.0098, h * 0.0085, 0, 0, 0, w * 0.3878, h * 0.831);
	c.lineTo(w * 0.4333, h * 0.8542);
	c.lineTo(w * 0.426, h * 0.8606);
	c.lineTo(w * 0.3878, h * 0.8415);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 0, w * 0.3976, h * 0.8585);
	c.close();

	c.moveTo(w * 0.6171, h * 0.8063);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 1, w * 0.6366, h * 0.8092);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 1, w * 0.639, h * 0.8303);
	c.arcTo(w * 0.065, h * 0.0563, 0, 0, 1, w * 0.6211, h * 0.8592);
	c.lineTo(w * 0.5894, h * 0.8761);
	c.arcTo(w * 0.0203, h * 0.0176, 0, 0, 1, w * 0.565, h * 0.8732);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.5659, h * 0.8458);
	c.arcTo(w * 0.0488, h * 0.0422, 0, 0, 1, w * 0.5805, h * 0.8246);
	c.close();
	c.moveTo(w * 0.5886, h * 0.8296);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 0, w * 0.5748, h * 0.8472);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 0, w * 0.574, h * 0.862);
	c.arcTo(w * 0.0098, h * 0.0085, 0, 0, 0, w * 0.587, h * 0.8676);
	c.lineTo(w * 0.6163, h * 0.8528);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 0, w * 0.6285, h * 0.8359);
	c.arcTo(w * 0.0244, h * 0.0211, 0, 0, 0, w * 0.6293, h * 0.8225);
	c.arcTo(w * 0.0098, h * 0.0085, 0, 0, 0, w * 0.6163, h * 0.8155);
	c.close();

	c.moveTo(w * 0.64, h * 0.85);
	c.lineTo(w * 0.64, h * 0.7930);
	c.lineTo(w * 0.6854, h * 0.7718);
	c.arcTo(w * 0.0106, h * 0.0092, 0, 0, 1, w * 0.7008, h * 0.7782);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.6959, h * 0.8);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.6805, h * 0.8127);
	c.lineTo(w * 0.6992, h * 0.8218);
	c.lineTo(w * 0.6854, h * 0.8282);
	c.lineTo(w * 0.6569, h * 0.8141);
	c.lineTo(w * 0.6805, h * 0.8021);
	c.arcTo(w * 0.0203, h * 0.0176, 0, 0, 0, w * 0.6894, h * 0.7923);
	c.arcTo(w * 0.0244, h * 0.0211, 0, 0, 0, w * 0.6894, h * 0.7845);
	c.arcTo(w * 0.0041, h * 0.0035, 0, 0, 0, w * 0.6837, h * 0.7831);
	c.lineTo(w * 0.6528, h * 0.7979);
	c.lineTo(w * 0.6528, h * 0.8437);
	c.close();
	c.moveTo(w * 0.7, h * 0.8204);
	c.lineTo(w * 0.7301, h * 0.7507);
	c.arcTo(w * 0.0098, h * 0.0085, 0, 0, 1, w * 0.7358, h * 0.7444);
	c.arcTo(w * 0.0098, h * 0.0085, 0, 0, 1, w * 0.7415, h * 0.7486);
	c.lineTo(w * 0.7699, h * 0.7852);
	c.lineTo(w * 0.7602, h * 0.7908);
	c.lineTo(w * 0.7537, h * 0.7838);
	c.lineTo(w * 0.7276, h * 0.7958);
	c.lineTo(w * 0.7228, h * 0.788);
	c.lineTo(w * 0.748, h * 0.7768);
	c.lineTo(w * 0.7358, h * 0.7585);
	c.lineTo(w * 0.7114, h * 0.8155);
	c.close();
	c.moveTo(w * 0.8244, h * 0.7486);
	c.lineTo(w * 0.8171, h * 0.762);
	c.lineTo(w * 0.7894, h * 0.7761);
	c.arcTo(w * 0.0244, h * 0.0211, 0, 0, 1, w * 0.7683, h * 0.7746);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.7667, h * 0.7507);
	c.arcTo(w * 0.0488, h * 0.0423, 0, 0, 1, w * 0.7937, h * 0.7162);
	c.lineTo(w * 0.822, h * 0.7035);
	c.lineTo(w * 0.8171, h * 0.7155);
	c.lineTo(w * 0.7902, h * 0.7296);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 0, w * 0.778, h * 0.743);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 0, w * 0.7756, h * 0.7606);
	c.arcTo(w * 0.0077, h * 0.0067, 0, 0, 0, w * 0.787, h * 0.767);
	c.close();
	c.moveTo(w * 0.8366, h * 0.6949);
	c.lineTo(w * 0.8366, h * 0.7423);
	c.lineTo(w * 0.878, h * 0.7231);
	c.lineTo(w * 0.874, h * 0.7338);
	c.lineTo(w * 0.8333, h * 0.7535);
	c.arcTo(w * 0.0041, h * 0.0035, 0, 0, 1, w * 0.8268, h * 0.75);
	c.lineTo(w * 0.8268, h * 0.7007);
	c.close();
	c.moveTo(w * 0.9342, h * 0.6472);
	c.lineTo(w * 0.9293, h * 0.6599);
	c.lineTo(w * 0.9033, h * 0.6725);
	c.arcTo(w * 0.0325, h * 0.0282, 0, 0, 0, w * 0.8927, h * 0.6817);
	c.arcTo(w * 0.0406, h * 0.0352, 0, 0, 0, w * 0.887, h * 0.6937);
	c.lineTo(w * 0.9309, h * 0.6725);
	c.lineTo(w * 0.9268, h * 0.6845);
	c.lineTo(w * 0.887, h * 0.7035);
	c.arcTo(w * 0.0089, h * 0.0077, 0, 0, 0, w * 0.8992, h * 0.7106);
	c.lineTo(w * 0.935, h * 0.693);
	c.lineTo(w * 0.9285, h * 0.7063);
	c.lineTo(w * 0.9008, h * 0.7197);
	c.arcTo(w * 0.0163, h * 0.0141, 0, 0, 1, w * 0.8829, h * 0.7204);
	c.arcTo(w * 0.0407, h * 0.0352, 0, 0, 1, w * 0.8764, h * 0.7028);
	c.arcTo(w * 0.065, h * 0.0563, 0, 0, 1, w * 0.8959, h * 0.6669);
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.7464);
	c.lineTo(0, h * 0.25);
	c.lineTo(w * 0.5, h * 0.5);
	c.lineTo(w * 0.5, h);
	c.close();
	c.moveTo(w * 0.5, h * 0.5);
	c.lineTo(w, h * 0.25);
	c.lineTo(w, h * 0.7464);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();

	c.setLineJoin('miter');
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.374, h * 0.3873);
	c.arcTo(w * 0.0325, h * 0.01764, 0, 0, 1, w * 0.374, h * 0.3626);
	c.lineTo(w * 0.4797, h * 0.3098);
	c.arcTo(w * 0.0325, h * 0.0141, 0, 0, 1, w * 0.5203, h * 0.3098);
	c.lineTo(w * 0.626, h * 0.3626);
	c.arcTo(w * 0.0325, h * 0.01764, 0, 0, 1, w * 0.626, h * 0.3852);
	c.lineTo(w * 0.5203, h * 0.438);
	c.arcTo(w * 0.0325, h * 0.0141, 0, 0, 1, w * 0.4797, h * 0.438);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7464);
	c.lineTo(0, h * 0.25);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.25);
	c.lineTo(w, h * 0.7464);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dOracleServer.prototype.cst.ORACLE_SERVER, mxShapeAws3dOracleServer);

//**********************************************************************************************************************************************************
//Secure Connection
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dSecureConnection(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dSecureConnection, mxShape);

mxShapeAws3dSecureConnection.prototype.cst = {
		SECURE_CONNECTION : 'mxgraph.aws3d.secureConnection'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dSecureConnection.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 57;
	var strokeWidth2 = strokeWidth * h /34;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	c.setStrokeWidth(strokeWidth);
	
	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dSecureConnection.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.begin();
	c.moveTo(w * 0.0058, h * 0.3889);
	c.arcTo(w * 0.2096, h * 0.3536, 0, 0, 1, w * 0.0774, h * 0.1856);
	c.arcTo(w * 0.5241, h * 0.8839, 0, 0, 1, w * 0.308, h * 0.0262);
	c.arcTo(w * 0.8735, h * 1.4732, 0, 0, 1, w * 0.6417, h * 0.056);
	c.arcTo(w * 0.6988, h * 1.1786, 0, 0, 1, w * 0.9106, h * 0.277);
	c.arcTo(w * 0.2621, h * 0.442, 0, 0, 1, w, h * 0.5451);
	c.arcTo(w * 0.2096, h * 0.3536, 0, 0, 1, w * 0.9474, h * 0.7808);
	c.arcTo(w * 0.4368, h * 0.7366, 0, 0, 1, w * 0.7186, h * 0.9605);
	c.arcTo(w * 0.8735, h * 1.4732, 0, 0, 1, w * 0.3045, h * 0.9104);
	c.arcTo(w * 0.6115, h * 1.0312, 0, 0, 1, w * 0.0687, h * 0.6747);
	c.arcTo(w * 0.2096, h * 0.3536, 0, 0, 1, w * 0.0058, h * 0.3889);
	c.close();
	c.fill();
};

mxShapeAws3dSecureConnection.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);

	c.begin();
	c.moveTo(w * 0.2661, h * 0.5068);
	c.lineTo(w * 0.5002, h * 0.7336);
	c.lineTo(w * 0.6626, h * 0.5775);
	c.lineTo(w * 0.6469, h * 0.5539);
	c.lineTo(w * 0.6958, h * 0.5097);
	c.arcTo(w * 0.0874, h * 0.1473, 0, 0, 0, w * 0.7325, h * 0.4066);
	c.arcTo(w * 0.0874, h * 0.1473, 0, 0, 0, w * 0.6889, h * 0.3153);
	c.arcTo(w * 0.1747, h * 0.2946, 0, 0, 0, w * 0.5928, h * 0.2622);
	c.arcTo(w * 0.1398, h * 0.2357, 0, 0, 0, w * 0.5107, h * 0.3005);
	c.lineTo(w * 0.446, h * 0.3654);
	c.lineTo(w * 0.4268, h * 0.3477);
	c.close();
	c.moveTo(w * 0.4949, h * 0.4184);
	c.lineTo(w * 0.5491, h * 0.3624);
	c.arcTo(w * 0.1222, h * 0.2062, 0, 0, 1, w * 0.6277, h * 0.3536);
	c.arcTo(w * 0.0874, h * 0.1179, 0, 0, 1, w * 0.6679, h * 0.3978);
	c.arcTo(w * 0.0175, h * 0.0295, 0, 0, 1, w * 0.6626, h * 0.439);
	c.lineTo(w * 0.5928, h * 0.5068);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxShapeAws3dSecureConnection.prototype.cst.SECURE_CONNECTION, mxShapeAws3dSecureConnection);

//**********************************************************************************************************************************************************
//Email Service
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dEmailService(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dEmailService, mxShape);

mxShapeAws3dEmailService.prototype.cst = {
		EMAIL_SERVICE : 'mxgraph.aws3d.email_service',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dEmailService.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 151;
	var strokeWidth2 = strokeWidth * h / 192;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dEmailService.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.8182);
	c.lineTo(0, h * 0.1818);
	c.lineTo(w * 0.4007, 0);
	c.lineTo(w * 0.606, 0);
	c.lineTo(w, h * 0.1792);
	c.lineTo(w, h * 0.8182);
	c.lineTo(w * 0.5993, h);
	c.lineTo(w * 0.4007, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dEmailService.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dEmailService.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.2727);
	c.lineTo(w * 0.4007, h * 0.4546);
	c.lineTo(w * 0.5993, h * 0.4546);
	c.lineTo(w * 0.5993, h);
	c.lineTo(w * 0.4007, h);
	c.lineTo(0, h * 0.8182);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5993, h * 0.4546);
	c.lineTo(w, h * 0.2727);
	c.lineTo(w * 0.8013, h * 0.1792);
	c.lineTo(w * 0.8013, h * 0.0883);
	c.lineTo(w, h * 0.1792);
	c.lineTo(w, h * 0.8182);
	c.lineTo(w * 0.5993, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.2727);
	c.lineTo(w * 0.4007, h * 0.4546);
	c.lineTo(w * 0.5993, h * 0.4546);
	c.lineTo(w * 0.5993, h);
	c.lineTo(w * 0.4007, h);
	c.lineTo(0, h * 0.8182);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.5993, h * 0.4546);
	c.lineTo(w, h * 0.2727);
	c.lineTo(w * 0.8013, h * 0.1792);
	c.lineTo(w * 0.8013, h * 0.0883);
	c.lineTo(w, h * 0.1792);
	c.lineTo(w, h * 0.8182);
	c.lineTo(w * 0.5993, h);
	c.close();
	c.stroke();
	
	c.begin();
	c.moveTo(w * 0.202, h * 0.0883);
	c.lineTo(w * 0.202, h * 0.1818);
	c.lineTo(w * 0.4007, h * 0.2727);
	c.lineTo(w * 0.5993, h * 0.2727);
	c.lineTo(w * 0.798, h * 0.1818);
	c.moveTo(w * 0.2053, h * 0.1818);
	c.lineTo(w * 0.0033, h * 0.2714);
	c.moveTo(w * 0.4007, h * 0.2727);
	c.lineTo(w * 0.4007, h * 0.9961);
	c.moveTo(w * 0.5993, h * 0.2727);
	c.lineTo(w * 0.5993, h * 0.4546);
	c.stroke();
	
	c.setLineJoin('miter');
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.4437, h * 0.0779);
	c.arcTo(w * 0.0662, h * 0.0519, 0, 0, 1, w * 0.404, h * 0.0706);
	c.arcTo(w * 0.0464, h * 0.0364, 0, 0, 1, w * 0.3815, h * 0.0421);
	c.arcTo(w * 0.053, h * 0.026, 0, 0, 1, w * 0.4205, h * 0.0187);
	c.arcTo(w * 0.1987, h * 0.1558, 0, 0, 1, w * 0.4768, h * 0.0203);
	c.arcTo(w * 0.0795, h * 0.0364, 0, 0, 1, w * 0.5199, h * 0.0494);
	c.arcTo(w * 0.0265, h * 0.0208, 0, 0, 1, w * 0.5099, h * 0.0649);
	c.arcTo(w * 0.0795, h * 0.0623, 0, 0, 1, w * 0.4536, h * 0.0727);
	c.arcTo(w * 0.0199, h * 0.0156, 0, 0, 1, w * 0.4404, h * 0.0597);
	c.arcTo(w * 0.0265, h * 0.0208, 0, 0, 1, w * 0.4219, h * 0.0566);
	c.arcTo(w * 0.0199, h * 0.0114, 0, 0, 1, w * 0.4172, h * 0.0431);
	c.arcTo(w * 0.0265, h * 0.0208, 0, 0, 1, w * 0.4483, h * 0.0416);
	c.arcTo(w * 0.0132, h * 0.0104, 0, 0, 1, w * 0.457, h * 0.053);
	c.arcTo(w * 0.0132, h * 0.0104, 0, 0, 0, w * 0.4669, h * 0.0431);
	c.arcTo(w * 0.0166, h * 0.0166, 0, 0, 0, w * 0.4464, h * 0.0358);
	c.lineTo(w * 0.4437, h * 0.0338);
	c.arcTo(w * 0.0199, h * 0.0156, 0, 0, 1, w * 0.4603, h * 0.0322);
	c.arcTo(w * 0.0397, h * 0.0156, 0, 0, 1, w * 0.4755, h * 0.0462);
	c.arcTo(w * 0.0199, h * 0.0156, 0, 0, 1, w * 0.4669, h * 0.0545);
	c.arcTo(w * 0.053, h * 0.0416, 0, 0, 1, w * 0.453, h * 0.0608);
	c.arcTo(w * 0.0099, h * 0.0078, 0, 0, 0, w * 0.4636, h * 0.0675);
	c.arcTo(w * 0.0662, h * 0.0519, 0, 0, 0, w * 0.498, h * 0.0623);
	c.arcTo(w * 0.0185, h * 0.0145, 0, 0, 0, w * 0.5079, h * 0.0457);
	c.arcTo(w * 0.053, h * 0.0416, 0, 0, 0, w * 0.4848, h * 0.0296);
	c.arcTo(w * 0.0993, h * 0.0779, 0, 0, 0, w * 0.455, h * 0.0234);
	c.arcTo(w * 0.1325, h * 0.1039, 0, 0, 0, w * 0.4172, h * 0.026);
	c.arcTo(w * 0.0397, h * 0.0312, 0, 0, 0, w * 0.3927, h * 0.039);
	c.arcTo(w * 0.0265, h * 0.0208, 0, 0, 0, w * 0.3974, h * 0.0571);
	c.arcTo(w * 0.053, h * 0.0416, 0, 0, 0, w * 0.4205, h * 0.0701);
	c.arcTo(w * 0.0331, h * 0.026, 0, 0, 0, w * 0.4404, h * 0.0722);
	c.moveTo(w * 0.42, h * 0.049);
	c.arcTo(w * 0.02, h * 0.02, 0, 0, 0, w * 0.435, h * 0.055);
	c.arcTo(w * 0.02, h * 0.02, 0, 0, 0, w * 0.45, h * 0.049);
	c.arcTo(w * 0.02, h * 0.02, 0, 0, 0, w * 0.435, h * 0.043);
	c.arcTo(w * 0.02, h * 0.02, 0, 0, 0, w * 0.42, h * 0.049);
	c.close();
	c.moveTo(w * 0.4669, h * 0.0894);
	c.arcTo(w * 0.1325, h * 0.1039, 0, 0, 0, w * 0.5099, h * 0.0831);
	c.lineTo(w * 0.6689, h * 0.1543);
	c.lineTo(w * 0.4887, h * 0.1371);
	c.close();
	c.moveTo(w * 0.3887, h * 0.0769);
	c.arcTo(w * 0.0662, h * 0.0519, 0, 0, 0, w * 0.4205, h * 0.0888);
	c.arcTo(w * 0.0662, h * 0.026, 0, 0, 0, w * 0.447, h * 0.0894);
	c.lineTo(w * 0.4735, h * 0.1512);
	c.lineTo(w * 0.6689, h * 0.1688);
	c.lineTo(w * 0.5199, h * 0.2364);
	c.lineTo(w * 0.2815, h * 0.1273);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.8182);
	c.lineTo(0, h * 0.1818);
	c.lineTo(w * 0.4007, 0);
	c.lineTo(w * 0.606, 0);
	c.lineTo(w, h * 0.1792);
	c.lineTo(w, h * 0.8182);
	c.lineTo(w * 0.5993, h);
	c.lineTo(w * 0.4007, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dEmailService.prototype.cst.EMAIL_SERVICE, mxShapeAws3dEmailService);

//**********************************************************************************************************************************************************
//Worker
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dWorker(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dWorker, mxShape);

mxShapeAws3dWorker.prototype.cst = {
		WORKER : 'mxgraph.aws3d.worker',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dWorker.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	var strokeWidth1 = strokeWidth * w / 74;
	var strokeWidth2 = strokeWidth * h / 50;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	
	c.setStrokeWidth(strokeWidth);
	c.setShadow(false);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if (isShadow == 1)
	{
		c.setShadow(true);
	}

	c.begin();
	c.moveTo(0, h * 0.572);
	c.lineTo(w * 0.0865, h * 0.284);
	c.lineTo(w * 0.4203, 0);
	c.lineTo(w * 0.5865, 0);
	c.lineTo(w * 0.919, h * 0.286);
	c.lineTo(w, h * 0.566);
	c.lineTo(w * 0.5027, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dWorker.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.566);
	c.lineTo(w * 0.0892, h * 0.282);
	c.lineTo(w * 0.0878, h * 0.426);
	c.lineTo(w * 0.4216, h * 0.712);
	c.lineTo(w * 0.5865, h * 0.712);
	c.lineTo(w * 0.5027, h);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5027, h);
	c.lineTo(w * 0.5865, h * 0.712);
	c.lineTo(w * 0.9176, h * 0.43);
	c.lineTo(w, h * 0.566);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.566);
	c.lineTo(w * 0.0892, h * 0.282);
	c.lineTo(w * 0.0878, h * 0.426);
	c.lineTo(w * 0.4216, h * 0.712);
	c.lineTo(w * 0.5865, h * 0.712);
	c.lineTo(w * 0.5027, h);
	c.close();
	c.moveTo(w * 0.5027, h);
	c.lineTo(w * 0.5865, h * 0.712);
	c.lineTo(w * 0.9176, h * 0.43);
	c.lineTo(w, h * 0.566);
	c.close();
	c.moveTo(0, h * 0.572);
	c.lineTo(w * 0.0892, h * 0.422);
	c.moveTo(w * 0.5027, h);
	c.lineTo(w * 0.4189, h * 0.708);
	c.moveTo(w * 0.9176, h * 0.43);
	c.lineTo(w * 0.9176, h * 0.29);
	c.stroke();

	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.setLineJoin('round');
	c.begin();
	c.moveTo(w * 0.2892, h * 0.2104);
	c.lineTo(w * 0.3595, h * 0.1503);
	c.lineTo(w * 0.3973, h * 0.1844);
	c.arcTo(w * 0.2703, h * 0.4008, 0, 0, 1, w * 0.4486, h * 0.1703);
	c.lineTo(w * 0.4486, h * 0.1242);
	c.lineTo(w * 0.5527, h * 0.1242);
	c.lineTo(w * 0.5527, h * 0.1703);
	c.arcTo(w * 0.2703, h * 0.4008, 0, 0, 1, w * 0.6149, h * 0.1924);
	c.lineTo(w * 0.6527, h * 0.1603);
	c.lineTo(w * 0.7257, h * 0.2224);
	c.lineTo(w * 0.6892, h * 0.2545);
	c.arcTo(w * 0.2027, h * 0.3006, 0, 0, 1, w * 0.7162, h * 0.3106);
	c.lineTo(w * 0.7676, h * 0.3106);
	c.lineTo(w * 0.7676, h * 0.3988);
	c.lineTo(w * 0.7162, h * 0.3988);
	c.arcTo(w * 0.2027, h * 0.3006, 0, 0, 1, w * 0.6973, h * 0.4409);
	c.lineTo(w * 0.7378, h * 0.475);
	c.lineTo(w * 0.6635, h * 0.5371);
	c.lineTo(w * 0.6297, h * 0.505);
	c.arcTo(w * 0.2703, h * 0.4008, 0, 0, 1, w * 0.5527, h * 0.5351);
	c.lineTo(w * 0.5527, h * 0.5812);
	c.lineTo(w * 0.45, h * 0.5812);
	c.lineTo(w * 0.45, h * 0.5351);
	c.arcTo(w * 0.2703, h * 0.4008, 0, 0, 1, w * 0.3878, h * 0.513);
	c.lineTo(w * 0.3514, h * 0.5431);
	c.lineTo(w * 0.2784, h * 0.481);
	c.lineTo(w * 0.3149, h * 0.4509);
	c.arcTo(w * 0.2027, h * 0.3006, 0, 0, 1, w * 0.2865, h * 0.3968);
	c.lineTo(w * 0.2351, h * 0.3968);
	c.lineTo(w * 0.2351, h * 0.3086);
	c.lineTo(w * 0.2865, h * 0.3086);
	c.arcTo(w * 0.2027, h * 0.3006, 0, 0, 1, w * 0.3203, h * 0.2425);
	c.close();
	c.moveTo(w * 0.4054, h * 0.2445);
	c.arcTo(w * 0.1351, h * 0.2004, 0, 0, 0, w * 0.3554, h * 0.2986);
	c.arcTo(w * 0.0676, h * 0.1002, 0, 0, 0, w * 0.3432, h * 0.3567);
	c.arcTo(w * 0.0811, h * 0.1202, 0, 0, 0, w * 0.3635, h * 0.4208);
	c.arcTo(w * 0.1351, h * 0.2004, 0, 0, 0, w * 0.4122, h * 0.4649);
	c.arcTo(w * 0.2027, h * 0.3006, 0, 0, 0, w * 0.4122, h * 0.4649);
	c.arcTo(w * 0.2027, h * 0.3006, 0, 0, 0, w * 0.5676, h * 0.4749);
	c.arcTo(w * 0.1351, h * 0.2004, 0, 0, 0, w * 0.6351, h * 0.4228);
	c.arcTo(w * 0.0676, h * 0.1002, 0, 0, 0, w * 0.6595, h * 0.3467);
	c.arcTo(w * 0.0811, h * 0.1202, 0, 0, 0, w * 0.6149, h * 0.2605);
	c.arcTo(w * 0.2027, h * 0.3006, 0, 0, 0, w * 0.5419, h * 0.2204);
	c.arcTo(w * 0.3378, h * 0.501, 0, 0, 0, w * 0.4649, h * 0.2184);
	c.arcTo(w * 0.2027, h * 0.3006, 0, 0, 0, w * 0.4054, h * 0.2445);
	c.close();
	c.moveTo(w * 0.473, h * 0.2806);
	c.arcTo(w * 0.2027, h * 0.3006, 0, 0, 1, w * 0.55, h * 0.2866);
	c.arcTo(w * 0.0676, h * 0.1002, 0, 0, 1, w * 0.5892, h * 0.3307);
	c.arcTo(w * 0.0338, h * 0.0501, 0, 0, 1, w * 0.5824, h * 0.3888);
	c.arcTo(w * 0.0946, h * 0.1403, 0, 0, 1, w * 0.5216, h * 0.4269);
	c.arcTo(w * 0.1622, h * 0.2405, 0, 0, 1, w * 0.4432, h * 0.4128);
	c.arcTo(w * 0.0541, h * 0.0802, 0, 0, 1, w * 0.4108, h * 0.3527);
	c.arcTo(w * 0.0541, h * 0.0802, 0, 0, 1, w * 0.4351, h * 0.2986);
	c.arcTo(w * 0.0811, h * 0.1202, 0, 0, 1, w * 0.473, h * 0.2806);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.572);
	c.lineTo(w * 0.0865, h * 0.284);
	c.lineTo(w * 0.4203, 0);
	c.lineTo(w * 0.5865, 0);
	c.lineTo(w * 0.919, h * 0.286);
	c.lineTo(w, h * 0.566);
	c.lineTo(w * 0.5027, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dWorker.prototype.cst.WORKER, mxShapeAws3dWorker);

//**********************************************************************************************************************************************************
//Application
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dApplication2(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dApplication2, mxShape);

mxShapeAws3dApplication2.prototype.cst = {
		APPLICATION2 : 'mxgraph.aws3d.application2',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dApplication2.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 62;
	var strokeWidth2 = strokeWidth * h / 53.5;
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	c.setShadow(false);
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if (isShadow == 1)
	{
		c.setShadow(true);
	}
	
	c.begin();
	c.moveTo(0, h * 0.6766);
	c.lineTo(0, h * 0.3271);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.3271);
	c.lineTo(w, h * 0.6766);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dApplication2.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.3271);
	c.lineTo(w * 0.5, h * 0.6449);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.6766);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5, h * 0.6449);
	c.lineTo(w, h * 0.3271);
	c.lineTo(w, h * 0.6766);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.3271);
	c.lineTo(w * 0.5, h * 0.6449);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.6766);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.5, h * 0.6449);
	c.lineTo(w, h * 0.3271);
	c.lineTo(w, h * 0.6766);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
	
	c.setLineJoin('miter');
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.1742, h * 0.6355);
	c.lineTo(w * 0.1742, h * 0.4393);
	c.lineTo(w * 0.6726, h * 0.1121);
	c.lineTo(w * 0.7661, h * 0.1738);
	c.lineTo(w * 0.2661, h * 0.4991);
	c.lineTo(w * 0.2661, h * 0.6916);
	c.close();
	c.moveTo(w * 0.2871, h * 0.7084);
	c.lineTo(w * 0.2871, h * 0.514);
	c.lineTo(w * 0.7823, h * 0.1869);
	c.lineTo(w * 0.8629, h * 0.2374);
	c.lineTo(w * 0.379, h * 0.5626);
	c.lineTo(w * 0.379, h * 0.7607);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.6766);
	c.lineTo(0, h * 0.3271);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.3271);
	c.lineTo(w, h * 0.6766);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dApplication2.prototype.cst.APPLICATION2, mxShapeAws3dApplication2);

//**********************************************************************************************************************************************************
//Elastic Beanstalk
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dElasticBeanstalk(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dElasticBeanstalk, mxShape);

mxShapeAws3dElasticBeanstalk.prototype.cst = {
		ELASTIC_BEANSTALK : 'mxgraph.aws3d.elasticBeanstalk',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dElasticBeanstalk.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 181.5;
	var strokeWidth2 = strokeWidth * h / 140;
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	c.setShadow(false);
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if (isShadow == 1)
	{
		c.setShadow(true);
	}
	
	c.begin();
	c.moveTo(0, h * 0.6239);
	c.lineTo(0, h * 0.3754);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.3754);
	c.lineTo(w, h * 0.6239);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dElasticBeanstalk.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.3754);
	c.lineTo(w * 0.5, h * 0.7514);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.6239);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5, h * 0.7514);
	c.lineTo(w, h * 0.3754);
	c.lineTo(w, h * 0.6239);
	c.lineTo(w * 0.5, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.3754);
	c.lineTo(w * 0.5, h * 0.7514);
	c.lineTo(w * 0.5, h);
	c.lineTo(0, h * 0.6239);
	c.close();
	c.moveTo(w * 0.5, h * 0.7514);
	c.lineTo(w, h * 0.3754);
	c.lineTo(w, h * 0.6239);
	c.lineTo(w * 0.5, h);
	c.close();
	c.moveTo(w * 0.2485, h * 0.187);
	c.lineTo(w * 0.7493, h * 0.5623);
	c.lineTo(w * 0.7493, h * 0.8123);
	c.stroke();
	
	c.setLineJoin('miter');
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.7763, h * 0.2063);
	c.lineTo(w * 0.2749, h * 0.5817);
	c.lineTo(w * 0.2749, h * 0.8309);
	c.lineTo(w * 0.2204, h * 0.7894);
	c.lineTo(w * 0.2204, h * 0.5394);
	c.lineTo(w * 0.7185, h * 0.1619);
	c.close();
	c.fill();

	c.restore();
	c.begin();
	c.moveTo(w * 0.1713, h * 0.543);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.2028, h * 0.5723);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.2281, h * 0.6096);
	c.arcTo(w * 0.1102, h * 0.1433, 0, 0, 1, w * 0.2402, h * 0.644);
	c.arcTo(w * 0.1102, h * 0.1433, 0, 0, 1, w * 0.2424, h * 0.6848);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.216, h * 0.6612);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.1895, h * 0.6239);
	c.arcTo(w * 0.1102, h * 0.1433, 0, 0, 1, w * 0.1719, h * 0.5824);
	c.arcTo(w * 0.0826, h * 0.1074, 0, 0, 1, w * 0.1713, h * 0.543);
	c.close();
	c.moveTo(w * 0.2507, h * 0.7794);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.254, h * 0.7421);
	c.arcTo(w * 0.022, h * 0.0287, 0, 0, 1, w * 0.27, h * 0.7264);
	c.arcTo(w * 0.0551, h * 0.0716, 0, 0, 1, w * 0.2986, h * 0.73);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.3234, h * 0.7457);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.3218, h * 0.7815);
	c.arcTo(w * 0.022, h * 0.0287, 0, 0, 1, w * 0.3019, h * 0.7987);
	c.arcTo(w * 0.0826, h * 0.1074, 0, 0, 1, w * 0.27, h * 0.7923);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.2507, h * 0.7794);
	c.close();
	c.moveTo(w * 0.2799, h * 0.5265);
	c.arcTo(w * 0.1102, h * 0.1433, 0, 0, 1, w * 0.3003, h * 0.515);
	c.arcTo(w * 0.0826, h * 0.1074, 0, 0, 1, w * 0.3317, h * 0.515);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.3774, h * 0.5315);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.4033, h * 0.5487);
	c.arcTo(w * 0.0826, h * 0.1074, 0, 0, 1, w * 0.3906, h * 0.5595);
	c.arcTo(w * 0.0826, h * 0.1074, 0, 0, 1, w * 0.3493, h * 0.5616);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.3069, h * 0.5444);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.2799, h * 0.5265);
	c.close();
	c.moveTo(w * 0.2887, h * 0.3933);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.314, h * 0.414);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.3322, h * 0.4391);
	c.arcTo(w * 0.0193, h * 0.0251, 0, 0, 1, w * 0.3344, h * 0.4699);
	c.arcTo(w * 0.0551, h * 0.0716, 0, 0, 1, w * 0.3196, h * 0.485);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.2887, h * 0.4592);
	c.arcTo(w * 0.1102, h * 0.1433, 0, 0, 1, w * 0.27, h * 0.4269);
	c.arcTo(w * 0.0165, h * 0.0215, 0, 0, 1, w * 0.2727, h * 0.4054);
	c.arcTo(w * 0.0551, h * 0.0716, 0, 0, 1, w * 0.2887, h * 0.3933);
	c.close();
	c.moveTo(w * 0.4613, h * 0.262);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.4867, h * 0.2827);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.5049, h * 0.3078);
	c.arcTo(w * 0.0193, h * 0.0251, 0, 0, 1, w * 0.5071, h * 0.3386);
	c.arcTo(w * 0.0551, h * 0.0716, 0, 0, 1, w * 0.4922, h * 0.3537);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.4613, h * 0.3279);
	c.arcTo(w * 0.1102, h * 0.1433, 0, 0, 1, w * 0.4426, h * 0.2956);
	c.arcTo(w * 0.0165, h * 0.0215, 0, 0, 1, w * 0.4453, h * 0.2741);
	c.arcTo(w * 0.0551, h * 0.0716, 0, 0, 1, w * 0.4613, h * 0.262);
	c.close();
	c.moveTo(w * 0.4525, h * 0.3952);
	c.arcTo(w * 0.1102, h * 0.1433, 0, 0, 1, w * 0.4729, h * 0.3837);
	c.arcTo(w * 0.0826, h * 0.1074, 0, 0, 1, w * 0.5043, h * 0.3837);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.55, h * 0.4002);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.5759, h * 0.4174);
	c.arcTo(w * 0.0826, h * 0.1074, 0, 0, 1, w * 0.5633, h * 0.4282);
	c.arcTo(w * 0.0826, h * 0.1074, 0, 0, 1, w * 0.5219, h * 0.4303);
	c.arcTo(w * 0.1653, h * 0.1074, 0, 0, 1, w * 0.4795, h * 0.4131);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.4525, h * 0.3952);
	c.close();
	c.moveTo(w * 0.6217, h * 0.1426);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.6471, h * 0.1633);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.6652, h * 0.1884);
	c.arcTo(w * 0.0193, h * 0.0251, 0, 0, 1, w * 0.6674, h * 0.2192);
	c.arcTo(w * 0.0551, h * 0.0716, 0, 0, 1, w * 0.6526, h * 0.2342);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.6217, h * 0.2085);
	c.arcTo(w * 0.1102, h * 0.1433, 0, 0, 1, w * 0.603, h * 0.1762);
	c.arcTo(w * 0.0165, h * 0.0215, 0, 0, 1, w * 0.6057, h * 0.1547);
	c.arcTo(w * 0.0551, h * 0.0716, 0, 0, 1, w * 0.6217, h * 0.1426);
	c.close();
	c.moveTo(w * 0.6129, h * 0.2758);
	c.arcTo(w * 0.1102, h * 0.1433, 0, 0, 1, w * 0.6333, h * 0.2643);
	c.arcTo(w * 0.0826, h * 0.1433, 0, 0, 1, w * 0.6647, h * 0.2643);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.7104, h * 0.2808);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.7363, h * 0.298);
	c.arcTo(w * 0.0826, h * 0.2149, 0, 0, 1, w * 0.7363, h * 0.298);
	c.arcTo(w * 0.0826, h * 0.1074, 0, 0, 1, w * 0.6823, h * 0.3109);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.6399, h * 0.2937);
	c.arcTo(w * 0.1653, h * 0.2149, 0, 0, 1, w * 0.6129, h * 0.2758);
	c.close();
	c.fillAndStroke();
	
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.6239);
	c.lineTo(0, h * 0.3754);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h * 0.3754);
	c.lineTo(w, h * 0.6239);
	c.lineTo(w * 0.5, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dElasticBeanstalk.prototype.cst.ELASTIC_BEANSTALK, mxShapeAws3dElasticBeanstalk);

//**********************************************************************************************************************************************************
//SimpleDB 2
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dSimpleDB2(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dSimpleDB2, mxShape);

mxShapeAws3dSimpleDB2.prototype.cst = {
		SIMPLE_DB_2 : 'mxgraph.aws3d.simpleDb2',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dSimpleDB2.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 181.5;
	var strokeWidth2 = strokeWidth * h / 210;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dSimpleDB2.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.8183);
	c.lineTo(0, h * 0.1848);
	c.lineTo(w * 0.3366, 0);
	c.lineTo(w * 0.6293, h * 0.0021);
	c.lineTo(w, h * 0.1833);
	c.lineTo(w, h * 0.8183);
	c.lineTo(w * 0.6694, h);
	c.lineTo(w * 0.4986, h * 0.9091);
	c.lineTo(w * 0.3333, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dSimpleDB2.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dSimpleDB2.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.1848);
	c.lineTo(w * 0.168, h * 0.1833);
	c.lineTo(0, h * 0.365);
	c.lineTo(w * 0.3333, h * 0.5467);
	c.lineTo(w * 0.3333, h);
	c.lineTo(0, h * 0.8183);
	c.close();
	c.moveTo(w * 0.4986, h * 0.9078);
	c.lineTo(w * 0.4986, h * 0.3655);
	c.lineTo(w * 0.6667, h * 0.5457);
	c.lineTo(w * 0.6667, h);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.3333, h * 0.5467);
	c.lineTo(w * 0.4986, h * 0.3655);
	c.lineTo(w * 0.4986, h * 0.9076);
	c.lineTo(w * 0.3333, h);
	c.close();
	c.moveTo(w * 0.8292, h * 0.1822);
	c.lineTo(w, h * 0.1848);
	c.lineTo(w, h * 0.8183);
	c.lineTo(w * 0.6667, h);
	c.lineTo(w * 0.6667, h * 0.5441);
	c.lineTo(w, h * 0.3666);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.1848);
	c.lineTo(w * 0.168, h * 0.1833);
	c.lineTo(0, h * 0.365);
	c.lineTo(w * 0.3333, h * 0.5467);
	c.lineTo(w * 0.3333, h);
	c.lineTo(0, h * 0.8183);
	c.close();
	c.moveTo(w * 0.4986, h * 0.9078);
	c.lineTo(w * 0.4986, h * 0.3655);
	c.lineTo(w * 0.6667, h * 0.5457);
	c.lineTo(w * 0.6667, h);
	c.close();
	c.moveTo(w * 0.3333, h * 0.5467);
	c.lineTo(w * 0.4986, h * 0.3655);
	c.lineTo(w * 0.4986, h * 0.9076);
	c.lineTo(w * 0.3333, h);
	c.close();
	c.moveTo(w * 0.8292, h * 0.1822);
	c.lineTo(w, h * 0.1848);
	c.lineTo(w, h * 0.8183);
	c.lineTo(w * 0.6667, h);
	c.lineTo(w * 0.6667, h * 0.5441);
	c.lineTo(w, h * 0.3666);
	c.close();
	c.moveTo(w * 0.1669, h * 0.1828);
	c.lineTo(w * 0.4986, h * 0.3655);
	c.lineTo(w * 0.8314, h * 0.1833);
	c.lineTo(w * 0.4986, h * 0.0031);
	c.close();
	c.stroke();

	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.2634, h * 0.1833);
	c.lineTo(w * 0.5003, h * 0.0535);
	c.lineTo(w * 0.7394, h * 0.1833);
	c.lineTo(w * 0.5003, h * 0.3136);
	c.close();
	c.fill();

	var fillColor = mxUtils.getValue(this.state.style, 'fillColor', '#000000');
	c.restore();
	c.setShadow(false);
	c.setStrokeWidth(3 * strokeWidth);
	c.setStrokeColor(fillColor);
	
	c.begin();
	c.moveTo(w * 0.3003, h * 0.2108);
	c.lineTo(w * 0.5642, h * 0.068);
	c.moveTo(w * 0.4429, h * 0.0693);
	c.lineTo(w * 0.7059, h * 0.2121);
	c.moveTo(w * 0.6667, h * 0.2458);
	c.lineTo(w * 0.3974, h * 0.0992);
	c.moveTo(w * 0.3499, h * 0.1277);
	c.lineTo(w * 0.6088, h * 0.2698);
	c.moveTo(w * 0.3009, h * 0.1556);
	c.lineTo(w * 0.5496, h * 0.2913);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.8183);
	c.lineTo(0, h * 0.1848);
	c.lineTo(w * 0.3366, 0);
	c.lineTo(w * 0.6293, h * 0.0021);
	c.lineTo(w, h * 0.1833);
	c.lineTo(w, h * 0.8183);
	c.lineTo(w * 0.6694, h);
	c.lineTo(w * 0.4986, h * 0.9091);
	c.lineTo(w * 0.3333, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dSimpleDB2.prototype.cst.SIMPLE_DB_2, mxShapeAws3dSimpleDB2);

//**********************************************************************************************************************************************************
//Workflow Service
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dWorkflowService(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dWorkflowService, mxShape);

mxShapeAws3dWorkflowService.prototype.cst = {
		WORKFLOW_SERVICE : 'mxgraph.aws3d.workflowService',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dWorkflowService.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 181.5;
	var strokeWidth2 = strokeWidth * h / 210;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dWorkflowService.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.6456);
	c.lineTo(w * 0.2481, 0);
	c.lineTo(w * 0.7497, 0);
	c.lineTo(w, h * 0.6456);
	c.lineTo(w * 0.4984, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dWorkflowService.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dWorkflowService.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.6456);
	c.lineTo(w * 0.2486, 0);
	c.lineTo(w * 0.2486, h * 0.3531);
	c.lineTo(w * 0.4984, h);
	c.close();
	c.moveTo(w * 0.7497, h * 0.3531);
	c.lineTo(w * 0.7497, 0);
	c.lineTo(w, h * 0.6456);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.4984, h);
	c.lineTo(w * 0.7486, h * 0.3531);
	c.lineTo(w, h * 0.6456);
	c.lineTo(w * 0.4967, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(w * 0.7497, h * 0.3531);
	c.lineTo(w * 0.7497, 0);
	c.lineTo(w, h * 0.6456);
	c.close();
	c.moveTo(0, h * 0.6456);
	c.lineTo(w * 0.2486, 0);
	c.lineTo(w * 0.2486, h * 0.3531);
	c.lineTo(w * 0.4984, h);
	c.lineTo(w * 0.7486, h * 0.3531);
	c.lineTo(w, h * 0.6456);
	c.lineTo(w * 0.4967, h);
	c.close();
	c.moveTo(w * 0.2486, h * 0.3531);
	c.lineTo(w * 0.7508, h * 0.3531);
	c.moveTo(w * 0.2488, h * 0.353);
	c.lineTo(0, h * 0.6486);
	c.stroke();

	c.restore();
	c.setShadow(false);
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	c.setStrokeWidth(2 * strokeWidth);

	c.begin();
	c.ellipse(w * 0.2925, h * 0.031, w * 0.4116, h * 0.2925);
	c.fill();
	
	var fillColor = mxUtils.getValue(this.state.style, 'fillColor', '#ffffff');
	c.setStrokeColor(fillColor);
	
	c.begin();
	c.moveTo(w * 0.5252, h * 0.0465);
	c.lineTo(w * 0.5873, h * 0.0903);
	c.lineTo(w * 0.5483, h * 0.1173);
	c.lineTo(w * 0.4874, h * 0.0728);
	c.close();
	c.moveTo(w * 0.4896, h * 0.1132);
	c.lineTo(w * 0.5005, h * 0.1705);
	c.lineTo(w * 0.4182, h * 0.1631);
	c.lineTo(w * 0.4122, h * 0.1058);
	c.close();
	c.moveTo(w * 0.3584, h * 0.1631);
	c.lineTo(w * 0.4204, h * 0.2062);
	c.lineTo(w * 0.3825, h * 0.2332);
	c.lineTo(w * 0.32, h * 0.19);
	c.close();
	c.moveTo(w * 0.4594, h * 0.2338);
	c.lineTo(w * 0.5214, h * 0.2783);
	c.lineTo(w * 0.4835, h * 0.3053);
	c.lineTo(w * 0.4215, h * 0.2608);
	c.close();
	c.moveTo(w * 0.5187, h * 0.0943);
	c.lineTo(w * 0.4879, h * 0.1152);
	c.moveTo(w * 0.421, h * 0.1624);
	c.lineTo(w * 0.3895, h * 0.1846);
	c.moveTo(w * 0.5, h * 0.1698);
	c.lineTo(w * 0.5554, h * 0.2089);
	c.lineTo(w * 0.4885, h * 0.2567);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.6456);
	c.lineTo(w * 0.2481, 0);
	c.lineTo(w * 0.7497, 0);
	c.lineTo(w, h * 0.6456);
	c.lineTo(w * 0.4984, h);
	c.close();
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dWorkflowService.prototype.cst.WORKFLOW_SERVICE, mxShapeAws3dWorkflowService);

//**********************************************************************************************************************************************************
//Decider
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dDecider(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dDecider, mxShape);

mxShapeAws3dDecider.prototype.cst = {
		DECIDER : 'mxgraph.aws3d.decider',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dDecider.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	var strokeWidth1 = strokeWidth * w / 74;
	var strokeWidth2 = strokeWidth * h / 50;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	
	c.setStrokeWidth(strokeWidth);
	c.setShadow(false);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if (isShadow == 1)
	{
		c.setShadow(true);
	}

	c.begin();
	c.moveTo(0, h * 0.572);
	c.lineTo(w * 0.0865, h * 0.284);
	c.lineTo(w * 0.4203, 0);
	c.lineTo(w * 0.5865, 0);
	c.lineTo(w * 0.919, h * 0.286);
	c.lineTo(w, h * 0.566);
	c.lineTo(w * 0.5027, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dDecider.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.566);
	c.lineTo(w * 0.0892, h * 0.282);
	c.lineTo(w * 0.0878, h * 0.426);
	c.lineTo(w * 0.4216, h * 0.712);
	c.lineTo(w * 0.5865, h * 0.712);
	c.lineTo(w * 0.5027, h);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5027, h);
	c.lineTo(w * 0.5865, h * 0.712);
	c.lineTo(w * 0.9176, h * 0.43);
	c.lineTo(w, h * 0.566);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.566);
	c.lineTo(w * 0.0892, h * 0.282);
	c.lineTo(w * 0.0878, h * 0.426);
	c.lineTo(w * 0.4216, h * 0.712);
	c.lineTo(w * 0.5865, h * 0.712);
	c.lineTo(w * 0.5027, h);
	c.close();
	c.moveTo(w * 0.5027, h);
	c.lineTo(w * 0.5865, h * 0.712);
	c.lineTo(w * 0.9176, h * 0.43);
	c.lineTo(w, h * 0.566);
	c.close();
	c.moveTo(0, h * 0.572);
	c.lineTo(w * 0.0892, h * 0.422);
	c.moveTo(w * 0.5027, h);
	c.lineTo(w * 0.4189, h * 0.708);
	c.moveTo(w * 0.9176, h * 0.43);
	c.lineTo(w * 0.9176, h * 0.29);
	c.stroke();

	c.setStrokeWidth(1.6 * strokeWidth);
	c.setLineJoin('square');
	c.begin();
	c.moveTo(w * 0.4973, h * 0.1523);
	c.lineTo(w * 0.5608, h * 0.0982);
	c.lineTo(w * 0.6581, h * 0.1844);
	c.lineTo(w * 0.5986, h * 0.2365);
	c.close();
	c.moveTo(w * 0.3784, h * 0.2164);
	c.lineTo(w * 0.5054, h * 0.2305);
	c.lineTo(w * 0.5203, h * 0.3407);
	c.lineTo(w * 0.3892, h * 0.3246);
	c.close();
	c.moveTo(w * 0.2932, h * 0.3246);
	c.lineTo(w * 0.3919, h * 0.4128);
	c.lineTo(w * 0.3334, h * 0.4647);
	c.lineTo(w * 0.2357, h * 0.38);
	c.close();
	c.moveTo(w * 0.4568, h * 0.4649);
	c.lineTo(w * 0.5554, h * 0.5511);
	c.lineTo(w * 0.4932, h * 0.6032);
	c.lineTo(w * 0.3946, h * 0.517);
	c.close();
	c.moveTo(w * 0.5473, h * 0.1924);
	c.lineTo(w * 0.5027, h * 0.2365);
	c.moveTo(w * 0.4, h * 0.3186);
	c.lineTo(w * 0.3446, h * 0.3667);
	c.moveTo(w * 0.5189, h * 0.3387);
	c.lineTo(w * 0.6081, h * 0.4148);
	c.lineTo(w * 0.5068, h * 0.501);
	c.stroke();

	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.572);
	c.lineTo(w * 0.0865, h * 0.284);
	c.lineTo(w * 0.4203, 0);
	c.lineTo(w * 0.5865, 0);
	c.lineTo(w * 0.919, h * 0.286);
	c.lineTo(w, h * 0.566);
	c.lineTo(w * 0.5027, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dDecider.prototype.cst.DECIDER, mxShapeAws3dDecider);

//**********************************************************************************************************************************************************
//Search Engine
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dSearchEngine(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dSearchEngine, mxShape);

mxShapeAws3dSearchEngine.prototype.cst = {
		SEARCH_ENGINE : 'mxgraph.aws3d.searchEngine',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dSearchEngine.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 180;
	var strokeWidth2 = strokeWidth * h / 192;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dSearchEngine.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7281);
	c.lineTo(w * 0.1667, h * 0.5444);
	c.lineTo(w * 0.1667, h * 0.1832);
	c.lineTo(w * 0.5011, 0);
	c.lineTo(w * 0.8333, h * 0.1832);
	c.lineTo(w * 0.8333, h * 0.5446);
	c.lineTo(w, h * 0.7281);
	c.lineTo(w * 0.7486, h * 0.7735);
	c.lineTo(w * 0.5819, h * 0.8617);
	c.lineTo(w * 0.5011, h);
	c.lineTo(w * 0.4169, h * 0.8653);
	c.lineTo(w * 0.2475, h * 0.7704);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dSearchEngine.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dSearchEngine.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(w * 0.1672, h * 0.1837);
	c.lineTo(w * 0.4989, h * 0.3638);
	c.lineTo(w * 0.4989, h * 0.7291);
	c.lineTo(w * 0.5825, h * 0.8633);
	c.lineTo(w * 0.4989, h);
	c.lineTo(w * 0.4164, h * 0.8622);
	c.lineTo(w * 0.2458, h * 0.7719);
	c.lineTo(0, h * 0.7276);
	c.lineTo(w * 0.1661, h * 0.5454);
	c.close();
	c.moveTo(w * 0.7486, h * 0.7714);
	c.lineTo(w * 0.8317, h * 0.5459);
	c.lineTo(w, h * 0.727);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.4989, h * 0.3643);
	c.lineTo(w * 0.8317, h * 0.1827);
	c.lineTo(w * 0.8317, h * 0.5465);
	c.lineTo(w * 0.7508, h * 0.7714);
	c.lineTo(w * 0.5836, h * 0.8633);
	c.lineTo(w * 0.4989, h * 0.727);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(w * 0.1672, h * 0.1837);
	c.lineTo(w * 0.4989, h * 0.3638);
	c.lineTo(w * 0.4989, h * 0.7291);
	c.lineTo(w * 0.5825, h * 0.8633);
	c.lineTo(w * 0.4989, h);
	c.lineTo(w * 0.4164, h * 0.8622);
	c.lineTo(w * 0.2458, h * 0.7719);
	c.lineTo(0, h * 0.7276);
	c.lineTo(w * 0.1661, h * 0.5454);
	c.close();
	c.moveTo(w * 0.7486, h * 0.7714);
	c.lineTo(w * 0.8317, h * 0.5459);
	c.lineTo(w, h * 0.727);
	c.close();
	c.moveTo(w * 0.4989, h * 0.3643);
	c.lineTo(w * 0.8317, h * 0.1827);
	c.lineTo(w * 0.8317, h * 0.5465);
	c.lineTo(w * 0.7508, h * 0.7714);
	c.lineTo(w * 0.5836, h * 0.8633);
	c.lineTo(w * 0.4989, h * 0.727);
	c.close();
	c.moveTo(w * 0.1667, h * 0.5459);
	c.lineTo(w * 0.2486, h * 0.7704);
	c.moveTo(w * 0.4164, h * 0.8633);
	c.lineTo(w * 0.4989, h * 0.727);
	c.lineTo(w * 0.4989, h);
	c.stroke();

	c.restore();
	c.setShadow(false);
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	
	c.begin();
	c.moveTo(w * 0.3427, h * 0.179);
	c.arcTo(w * 0.0277, h * 0.0261, 0, 0, 1, w * 0.3267, h * 0.1487);
	c.arcTo(w * 0.0664, h * 0.0365, 0, 0, 1, w * 0.3621, h * 0.1227);
	c.arcTo(w * 0.1052, h * 0.0992, 0, 0, 1, w * 0.4247, h * 0.1195);
	c.arcTo(w * 0.1274, h * 0.12, 0, 0, 1, w * 0.4884, h * 0.1018);
	c.arcTo(w * 0.1329, h * 0.1253, 0, 0, 1, w * 0.5548, h * 0.1112);
	c.arcTo(w * 0.0377, h * 0.0344, 0, 0, 1, w * 0.572, h * 0.166);
	c.arcTo(w * 0.0388, h * 0.0365, 0, 0, 1, w * 0.6047, h * 0.1775);
	c.arcTo(w * 0.021, h * 0.0198, 0, 0, 1, w * 0.5936, h * 0.2046);
	c.arcTo(w * 0.0332, h * 0.0313, 0, 0, 1, w * 0.6008, h * 0.2416);
	c.arcTo(w * 0.072, h * 0.0678, 0, 0, 1, w * 0.5437, h * 0.2677);
	c.arcTo(w * 0.1052, h * 0.0939, 0, 0, 1, w * 0.4828, h * 0.2563);
	c.close();
	c.moveTo(w * 0.448, h * 0.2156);
	c.arcTo(w * 0.0111, h * 0.0104, 0, 0, 0, w * 0.459, h * 0.2255);
	c.arcTo(w * 0.0138, h * 0.013, 0, 0, 0, w * 0.4729, h * 0.2182);
	c.lineTo(w * 0.4773, h * 0.1874);
	c.arcTo(w * 0.0664, h * 0.0626, 0, 0, 0, w * 0.5116, h * 0.1759);
	c.arcTo(w * 0.0277, h * 0.0626, 0, 0, 0, w * 0.5233, h * 0.1503);
	c.arcTo(w * 0.0554, h * 0.0261, 0, 0, 0, w * 0.5022, h * 0.1336);
	c.arcTo(w * 0.0886, h * 0.0835, 0, 0, 0, w * 0.4607, h * 0.1305);
	c.arcTo(w * 0.0664, h * 0.0626, 0, 0, 0, w * 0.4313, h * 0.142);
	c.arcTo(w * 0.0332, h * 0.0313, 0, 0, 0, w * 0.4175, h * 0.1597);
	c.arcTo(w * 0.0249, h * 0.0235, 0, 0, 0, w * 0.4313, h * 0.1822);
	c.arcTo(w * 0.0443, h * 0.0418, 0, 0, 0, w * 0.4535, h * 0.1884);
	c.close();
	c.moveTo(w * 0.4718, h * 0.1764);
	c.arcTo(w * 0.0443, h * 0.0418, 0, 0, 1, w * 0.4496, h * 0.1754);
	c.arcTo(w * 0.0221, h * 0.0157, 0, 0, 1, w * 0.4369, h * 0.1634);
	c.arcTo(w * 0.0221, h * 0.0183, 0, 0, 1, w * 0.4496, h * 0.1467);
	c.arcTo(w * 0.0609, h * 0.0574, 0, 0, 1, w * 0.4759, h * 0.1414);
	c.arcTo(w * 0.0388, h * 0.0365, 0, 0, 1, w * 0.5033, h * 0.1514);
	c.arcTo(w * 0.0443, h * 0.0209, 0, 0, 1, w * 0.495, h * 0.1701);
	c.arcTo(w * 0.0388, h * 0.0365, 0, 0, 1, w * 0.4718, h * 0.1764);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7281);
	c.lineTo(w * 0.1667, h * 0.5444);
	c.lineTo(w * 0.1667, h * 0.1832);
	c.lineTo(w * 0.5011, 0);
	c.lineTo(w * 0.8333, h * 0.1832);
	c.lineTo(w * 0.8333, h * 0.5446);
	c.lineTo(w, h * 0.7281);
	c.lineTo(w * 0.7486, h * 0.7735);
	c.lineTo(w * 0.5819, h * 0.8617);
	c.lineTo(w * 0.5011, h);
	c.lineTo(w * 0.4169, h * 0.8653);
	c.lineTo(w * 0.2475, h * 0.7704);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dSearchEngine.prototype.cst.SEARCH_ENGINE, mxShapeAws3dSearchEngine);

//**********************************************************************************************************************************************************
//Security Token Service
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dSecurityTokenService(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dSecurityTokenService, mxShape);

mxShapeAws3dSecurityTokenService.prototype.cst = {
		SECURITY_TOKEN_SERVICE : 'mxgraph.aws3d.securityTokenService',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dSecurityTokenService.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 180;
	var strokeWidth2 = strokeWidth * h / 192;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dSecurityTokenService.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.7281);
	c.lineTo(w * 0.1667, h * 0.5444);
	c.lineTo(w * 0.1667, h * 0.1832);
	c.lineTo(w * 0.5011, 0);
	c.lineTo(w * 0.8333, h * 0.1832);
	c.lineTo(w * 0.8333, h * 0.5446);
	c.lineTo(w, h * 0.7281);
	c.lineTo(w * 0.7486, h * 0.7735);
	c.lineTo(w * 0.5819, h * 0.8617);
	c.lineTo(w * 0.5011, h);
	c.lineTo(w * 0.4169, h * 0.8653);
	c.lineTo(w * 0.2475, h * 0.7704);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dSecurityTokenService.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dSecurityTokenService.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(w * 0.1672, h * 0.1837);
	c.lineTo(w * 0.4989, h * 0.3638);
	c.lineTo(w * 0.4989, h * 0.7291);
	c.lineTo(w * 0.5825, h * 0.8633);
	c.lineTo(w * 0.4989, h);
	c.lineTo(w * 0.4164, h * 0.8622);
	c.lineTo(w * 0.2458, h * 0.7719);
	c.lineTo(0, h * 0.7276);
	c.lineTo(w * 0.1661, h * 0.5454);
	c.close();
	c.moveTo(w * 0.7486, h * 0.7714);
	c.lineTo(w * 0.8317, h * 0.5459);
	c.lineTo(w, h * 0.727);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.4989, h * 0.3643);
	c.lineTo(w * 0.8317, h * 0.1827);
	c.lineTo(w * 0.8317, h * 0.5465);
	c.lineTo(w * 0.7508, h * 0.7714);
	c.lineTo(w * 0.5836, h * 0.8633);
	c.lineTo(w * 0.4989, h * 0.727);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(w * 0.1672, h * 0.1837);
	c.lineTo(w * 0.4989, h * 0.3638);
	c.lineTo(w * 0.4989, h * 0.7291);
	c.lineTo(w * 0.5825, h * 0.8633);
	c.lineTo(w * 0.4989, h);
	c.lineTo(w * 0.4164, h * 0.8622);
	c.lineTo(w * 0.2458, h * 0.7719);
	c.lineTo(0, h * 0.7276);
	c.lineTo(w * 0.1661, h * 0.5454);
	c.close();
	c.moveTo(w * 0.7486, h * 0.7714);
	c.lineTo(w * 0.8317, h * 0.5459);
	c.lineTo(w, h * 0.727);
	c.close();
	c.moveTo(w * 0.4989, h * 0.3643);
	c.lineTo(w * 0.8317, h * 0.1827);
	c.lineTo(w * 0.8317, h * 0.5465);
	c.lineTo(w * 0.7508, h * 0.7714);
	c.lineTo(w * 0.5836, h * 0.8633);
	c.lineTo(w * 0.4989, h * 0.727);
	c.close();
	c.moveTo(w * 0.1667, h * 0.5459);
	c.lineTo(w * 0.2486, h * 0.7704);
	c.moveTo(w * 0.4164, h * 0.8633);
	c.lineTo(w * 0.4989, h * 0.727);
	c.lineTo(w * 0.4989, h);
	c.stroke();

	c.restore();
	c.setShadow(false);
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	
	c.begin();
	c.moveTo(w * 0.4773, h * 0.1915);
	c.arcTo(w * 0.1274, h * 0.12, 0, 0, 1, w * 0.4358, h * 0.1968);
	c.arcTo(w * 0.1107, h * 0.1044, 0, 0, 1, w * 0.3937, h * 0.1905);
	c.arcTo(w * 0.0554, h * 0.0522, 0, 0, 1, w * 0.3682, h * 0.1707);
	c.arcTo(w * 0.0332, h * 0.0313, 0, 0, 1, w * 0.3699, h * 0.1414);
	c.arcTo(w * 0.0775, h * 0.0731, 0, 0, 1, w * 0.4009, h * 0.118);
	c.arcTo(w * 0.1107, h * 0.1044, 0, 0, 1, w * 0.4524, h * 0.1059);
	c.arcTo(w * 0.1107, h * 0.1044, 0, 0, 1, w * 0.5028, h * 0.1112);
	c.arcTo(w * 0.0664, h * 0.0626, 0, 0, 1, w * 0.531, h * 0.1315);
	c.arcTo(w * 0.0332, h * 0.0313, 0, 0, 1, w * 0.531, h * 0.1597);
	c.lineTo(w * 0.5615, h * 0.1754);
	c.lineTo(w * 0.5526, h * 0.1905);
	c.lineTo(w * 0.5759, h * 0.1999);
	c.lineTo(w * 0.5753, h * 0.2109);
	c.lineTo(w * 0.5792, h * 0.2161);
	c.lineTo(w * 0.6135, h * 0.2182);
	c.lineTo(w * 0.6113, h * 0.2416);
	c.lineTo(w * 0.5819, h * 0.2474);
	c.close();

	c.moveTo(w * 0.4756, h * 0.1816);
	c.arcTo(w * 0.0554, h * 0.0522, 0, 0, 0, w * 0.5, h * 0.1691);
	c.arcTo(w * 0.0332, h * 0.0313, 0, 0, 0, w * 0.5144, h * 0.1435);
	c.arcTo(w * 0.0277, h * 0.0261, 0, 0, 0, w * 0.4967, h * 0.1247);
	c.arcTo(w * 0.0554, h * 0.0522, 0, 0, 0, w * 0.4729, h * 0.1174);
	c.arcTo(w * 0.1107, h * 0.1044, 0, 0, 0, w * 0.4452, h * 0.1169);
	c.arcTo(w * 0.0831, h * 0.0783, 0, 0, 0, w * 0.4197, h * 0.1232);
	c.arcTo(w * 0.0554, h * 0.0522, 0, 0, 0, w * 0.397, h * 0.1357);
	c.arcTo(w * 0.0388, h * 0.0365, 0, 0, 0, w * 0.3859, h * 0.1555);
	c.arcTo(w * 0.0305, h * 0.0287, 0, 0, 0, w * 0.4053, h * 0.178);
	c.arcTo(w * 0.072, h * 0.0678, 0, 0, 0, w * 0.4385, h * 0.1863);
	c.arcTo(w * 0.0831, h * 0.0783, 0, 0, 0, w * 0.4596, h * 0.1848);
	c.arcTo(w * 0.0664, h * 0.0626, 0, 0, 0, w * 0.4756, h * 0.1816);
	c.fill();

	c.setStrokeWidth(1.5 * strokeWidth);
	c.setLineJoin('round');
	c.setLineCap('round');
	c.begin();
	c.moveTo(w * 0.4939, h * 0.1326);
	c.lineTo(w * 0.4474, h * 0.1508);
	c.lineTo(w * 0.4812, h * 0.1576);
	c.moveTo(w * 0.4889, h * 0.1733);
	c.lineTo(w * 0.4939, h * 0.1775);
	c.moveTo(w * 0.5061, h * 0.1576);
	c.lineTo(w * 0.5199, h * 0.1597);
	c.moveTo(w * 0.5094, h * 0.1394);
	c.lineTo(w * 0.5244, h * 0.1378);
	c.moveTo(w * 0.4945, h * 0.1247);
	c.lineTo(w * 0.4994, h * 0.1185);
	c.moveTo(w * 0.4679, h * 0.1175);
	c.lineTo(w * 0.4707, h * 0.1117);
	c.moveTo(w * 0.4396, h * 0.1195);
	c.lineTo(w * 0.4374, h * 0.1138);
	c.moveTo(w * 0.412, h * 0.1284);
	c.lineTo(w * 0.4059, h * 0.1232);
	c.moveTo(w * 0.3948, h * 0.1441);
	c.lineTo(w * 0.3804, h * 0.1425);
	c.moveTo(w * 0.3931, h * 0.1608);
	c.lineTo(w * 0.3804, h * 0.1649);
	c.moveTo(w * 0.4059, h * 0.1754);
	c.lineTo(w * 0.3998, h * 0.1801);
	c.moveTo(w * 0.4308, h * 0.1822);
	c.lineTo(w * 0.4286, h * 0.1884);
	c.moveTo(w * 0.4618, h * 0.1827);
	c.lineTo(w * 0.4635, h * 0.1868);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.7281);
	c.lineTo(w * 0.1667, h * 0.5444);
	c.lineTo(w * 0.1667, h * 0.1832);
	c.lineTo(w * 0.5011, 0);
	c.lineTo(w * 0.8333, h * 0.1832);
	c.lineTo(w * 0.8333, h * 0.5446);
	c.lineTo(w, h * 0.7281);
	c.lineTo(w * 0.7486, h * 0.7735);
	c.lineTo(w * 0.5819, h * 0.8617);
	c.lineTo(w * 0.5011, h);
	c.lineTo(w * 0.4169, h * 0.8653);
	c.lineTo(w * 0.2475, h * 0.7704);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dSecurityTokenService.prototype.cst.SECURITY_TOKEN_SERVICE, mxShapeAws3dSecurityTokenService);

//**********************************************************************************************************************************************************
//Glacier
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dGlacier(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dGlacier, mxShape);

mxShapeAws3dGlacier.prototype.cst = {
		GLACIER : 'mxgraph.aws3d.glacier',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dGlacier.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 180;
	var strokeWidth2 = strokeWidth * h / 192;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dGlacier.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.8177);
	c.lineTo(0, h * 0.5448);
	c.lineTo(w * 0.168, h * 0.1792);
	c.lineTo(w * 0.5008, 0);
	c.lineTo(w * 0.8309, h * 0.1812);
	c.lineTo(w, h * 0.5469);
	c.lineTo(w, h * 0.8188);
	c.lineTo(w * 0.6661, h);
	c.lineTo(w * 0.3333, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dGlacier.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dGlacier.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(w * 0.1658, h * 0.1802);
	c.lineTo(w * 0.5008, h * 0.3651);
	c.lineTo(w * 0.6661, h * 0.9089);
	c.lineTo(w * 0.6661, h);
	c.lineTo(w * 0.3339, h);
	c.lineTo(0, h * 0.8177);
	c.lineTo(0, h * 0.5427);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.5008, h * 0.362);
	c.lineTo(w * 0.8314, h * 0.1823);
	c.lineTo(w, h * 0.5469);
	c.lineTo(w, h * 0.8177);
	c.lineTo(w * 0.6661, h);
	c.lineTo(w * 0.6661, h * 0.9089);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(w * 0.1658, h * 0.1802);
	c.lineTo(w * 0.5008, h * 0.3651);
	c.lineTo(w * 0.6661, h * 0.9089);
	c.lineTo(w * 0.6661, h);
	c.lineTo(w * 0.3339, h);
	c.lineTo(0, h * 0.8177);
	c.lineTo(0, h * 0.5427);
	c.close();
	c.moveTo(w * 0.5008, h * 0.362);
	c.lineTo(w * 0.8314, h * 0.1823);
	c.lineTo(w, h * 0.5469);
	c.lineTo(w, h * 0.8177);
	c.lineTo(w * 0.6661, h);
	c.lineTo(w * 0.6661, h * 0.9089);
	c.close();
	c.moveTo(w * 0.1675, h * 0.1797);
	c.lineTo(0, h * 0.7281);
	c.lineTo(w * 0.3284, h * 0.9089);
	c.lineTo(w * 0.6661, h * 0.9089);
	c.lineTo(w, h * 0.7266);
	c.lineTo(w * 0.8309, h * 0.1823);
	c.moveTo(w * 0.5003, h * 0.362);
	c.lineTo(w * 0.3311, h * 0.9089);
	c.lineTo(w * 0.3311, h);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.8177);
	c.lineTo(0, h * 0.5448);
	c.lineTo(w * 0.168, h * 0.1792);
	c.lineTo(w * 0.5008, 0);
	c.lineTo(w * 0.8309, h * 0.1812);
	c.lineTo(w, h * 0.5469);
	c.lineTo(w, h * 0.8188);
	c.lineTo(w * 0.6661, h);
	c.lineTo(w * 0.3333, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dGlacier.prototype.cst.GLACIER, mxShapeAws3dGlacier);

//**********************************************************************************************************************************************************
//Customer Gateway
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dCustomerGateway(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dCustomerGateway, mxShape);

mxShapeAws3dCustomerGateway.prototype.cst = {
		CUSTOMER_GATEWAY : 'mxgraph.aws3d.customerGateway',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dCustomerGateway.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 116.7;
	var strokeWidth2 = strokeWidth * h / 102.8;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dCustomerGateway.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(w * 0.4199, h * 0.5447);
	c.lineTo(w * 0.4199, h * 0.035);
	c.lineTo(w * 0.8946, 0);
	c.lineTo(w, h * 0.0691);
	c.lineTo(w, h * 0.4134);
	c.lineTo(w * 0.6812, h * 0.7247);
	c.close();
	c.fillAndStroke();

	c.restore();
	c.save();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dCustomerGateway.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	c.begin();
	c.moveTo(w * 0.4199, h * 0.5447);
	c.lineTo(w * 0.4199, h * 0.035);
	c.lineTo(w * 0.6838, h * 0.2072);
	c.lineTo(w * 0.6838, h * 0.7247);
	c.close();
	c.fill();
	
	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.6838, h * 0.2072);
	c.lineTo(w, h * 0.0691);
	c.lineTo(w, h * 0.4134);
	c.lineTo(w * 0.6838, h * 0.7247);
	c.close();
	c.fill();

	c.restore();
	c.setShadow(false);
	c.begin();
	c.moveTo(w * 0.4199, h * 0.5447);
	c.lineTo(w * 0.4199, h * 0.035);
	c.lineTo(w * 0.6838, h * 0.2072);
	c.lineTo(w * 0.6838, h * 0.7247);
	c.close();
	c.stroke();

	c.restore();
	c.setLineJoin('round');
	c.setShadow(false);

	c.begin();
	c.moveTo(w * 0.6838, h * 0.2072);
	c.lineTo(w, h * 0.0691);
	c.lineTo(w, h * 0.4134);
	c.lineTo(w * 0.6838, h * 0.7247);
	c.close();
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	
	c.begin();
	c.moveTo(w * 0.4199, h * 0.5447);
	c.lineTo(w * 0.4199, h * 0.035);
	c.lineTo(w * 0.8946, 0);
	c.lineTo(w, h * 0.0691);
	c.lineTo(w, h * 0.4134);
	c.lineTo(w * 0.6812, h * 0.7247);
	c.close();
	c.stroke();

	c.restore();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.929);
	c.lineTo(0, h * 0.5866);
	c.lineTo(w * 0.3171, h * 0.1031);
	c.lineTo(w * 0.5784, h * 0.2753);
	c.lineTo(w * 0.5784, h * 0.7928);
	c.lineTo(w * 0.1054, h);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dCustomerGateway.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setShadow(false);
	c.setLineJoin('round');
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dCustomerGateway.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.929);
	c.lineTo(0, h * 0.5866);
	c.lineTo(w * 0.1054, h * 0.6537);
	c.lineTo(w * 0.1054, h);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.1054, h);
	c.lineTo(w * 0.1054, h * 0.6537);
	c.lineTo(w * 0.5784, h * 0.2753);
	c.lineTo(w * 0.5784, h * 0.7928);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.929);
	c.lineTo(0, h * 0.5866);
	c.lineTo(w * 0.1054, h * 0.6537);
	c.lineTo(w * 0.1054, h);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.1054, h);
	c.lineTo(w * 0.1054, h * 0.6537);
	c.lineTo(w * 0.5784, h * 0.2753);
	c.lineTo(w * 0.5784, h * 0.7928);
	c.close();
	c.stroke();
	
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.929);
	c.lineTo(0, h * 0.5866);
	c.lineTo(w * 0.3171, h * 0.1031);
	c.lineTo(w * 0.5784, h * 0.2753);
	c.lineTo(w * 0.5784, h * 0.7928);
	c.lineTo(w * 0.1054, h);
	c.close();
	c.stroke();
	
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.7575, h * 0.3969);
	c.arcTo(w * 0.2142, h * 0.2432, 0, 0, 1, w * 0.7686, h * 0.3259);
	c.arcTo(w * 0.2142, h * 0.2432, 0, 0, 1, w * 0.8055, h * 0.2481);
	c.arcTo(w * 0.2142, h * 0.2432, 0, 0, 1, w * 0.8406, h * 0.2091);
	c.lineTo(w * 0.8269, h * 0.2665);
	c.lineTo(w * 0.8372, h * 0.2607);
	c.lineTo(w * 0.8372, h * 0.3444);
	c.lineTo(w * 0.7832, h * 0.3804);
	c.lineTo(w * 0.7832, h * 0.3658);
	c.close();
	c.moveTo(w * 0.8466, h * 0.2082);
	c.arcTo(w * 0.0514, h * 0.0584, 0, 0, 1, w * 0.8766, h * 0.1955);
	c.arcTo(w * 0.0514, h * 0.0584, 0, 0, 1, w * 0.9186, h * 0.2286);
	c.arcTo(w * 0.12, h * 0.1362, 0, 0, 1, w * 0.9297, h * 0.2821);
	c.lineTo(w * 0.9006, h * 0.2831);
	c.lineTo(w * 0.9006, h * 0.3016);
	c.lineTo(w * 0.85, h * 0.3366);
	c.lineTo(w * 0.85, h * 0.251);
	c.lineTo(w * 0.8586, h * 0.2471);
	c.close();
	c.moveTo(w * 0.9297, h * 0.2967);
	c.arcTo(w * 0.2142, h * 0.2432, 0, 0, 1, w * 0.9195, h * 0.3667);
	c.arcTo(w * 0.2571, h * 0.2918, 0, 0, 1, w * 0.8869, h * 0.4436);
	c.arcTo(w * 0.1714, h * 0.1946, 0, 0, 1, w * 0.8466, h * 0.4903);
	c.lineTo(w * 0.8595, h * 0.4358);
	c.lineTo(w * 0.8492, h * 0.4416);
	c.lineTo(w * 0.8492, h * 0.357);
	c.lineTo(w * 0.9006, h * 0.32004);
	c.lineTo(w * 0.9006, h * 0.3346);
	c.close();
	c.moveTo(w * 0.838, h * 0.4942);
	c.arcTo(w * 0.0857, h * 0.0973, 0, 0, 1, w * 0.8072, h * 0.5049);
	c.arcTo(w * 0.0514, h * 0.0584, 0, 0, 1, w * 0.7712, h * 0.4815);
	c.arcTo(w * 0.1714, h * 0.1946, 0, 0, 1, w * 0.7566, h * 0.4163);
	c.lineTo(w * 0.7832, h * 0.4173);
	c.lineTo(w * 0.7832, h * 0.4008);
	c.lineTo(w * 0.8372, h * 0.3638);
	c.lineTo(w * 0.8372, h * 0.4494);
	c.lineTo(w * 0.8278, h * 0.4562);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxShapeAws3dCustomerGateway.prototype.cst.CUSTOMER_GATEWAY, mxShapeAws3dCustomerGateway);

//**********************************************************************************************************************************************************
//Redshift
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dRedshift(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dRedshift, mxShape);

mxShapeAws3dRedshift.prototype.cst = {
		REDSHIFT : 'mxgraph.aws3d.redshift',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dRedshift.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 149.5;
	var strokeWidth2 = strokeWidth * h / 187.5;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dRedshift.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.6517);
	c.lineTo(0, h * 0.0912);
	c.lineTo(w * 0.0368, h * 0.0155);
	c.lineTo(w * 0.2047, 0);
	c.lineTo(w * 0.3378, h * 0.0619);
	c.lineTo(w * 0.3378, h * 0.0912);
	c.lineTo(w * 0.3819, h * 0.0693);
	c.lineTo(w * 0.6154, h * 0.0693);
	c.lineTo(w * 0.8502, h * 0.1776);
	c.lineTo(w * 0.8502, h * 0.3083);
	c.lineTo(w * 0.8682, h * 0.3061);
	c.lineTo(w, h * 0.3664);
	c.lineTo(w, h * 0.9099);
	c.lineTo(w * 0.9672, h * 0.9861);
	c.lineTo(w * 0.7926, h);
	c.lineTo(w * 0.6629, h * 0.9392);
	c.lineTo(w * 0.6629, h * 0.9099);
	c.lineTo(w * 0.6167, h * 0.9317);
	c.lineTo(w * 0.3813, h * 0.9317);
	c.lineTo(w * 0.1478, h * 0.8219);
	c.lineTo(w * 0.1478, h * 0.7093);
	c.lineTo(w * 0.1365, h * 0.7163);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dRedshift.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dRedshift.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.6541);
	c.lineTo(0, h * 0.0933);
	c.lineTo(w * 0.1371, h * 0.1573);
	c.lineTo(w * 0.1371, h * 0.7157);
	c.close();
	c.moveTo(w * 0.1485, h * 0.8219);
	c.lineTo(w * 0.1485, h * 0.2864);
	c.lineTo(w * 0.3846, h * 0.3941);
	c.lineTo(w * 0.3846, h * 0.9317);
	c.close();
	c.moveTo(w * 0.6642, h * 0.9392);
	c.lineTo(w * 0.6642, h * 0.4011);
	c.lineTo(w * 0.796, h * 0.4597);
	c.lineTo(w * 0.796, h);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.1371, h * 0.7157);
	c.lineTo(w * 0.1371, h * 0.1568);
	c.lineTo(w * 0.2027, h * 0.1525);
	c.lineTo(w * 0.1498, h * 0.1771);
	c.lineTo(w * 0.1498, h * 0.7061);
	c.close();
	c.moveTo(w * 0.3846, h * 0.3941);
	c.lineTo(w * 0.614, h * 0.3941);
	c.lineTo(w * 0.6809, h * 0.3632);
	c.lineTo(w * 0.6642, h * 0.4);
	c.lineTo(w * 0.6642, h * 0.9067);
	c.lineTo(w * 0.6191, h * 0.9317);
	c.lineTo(w * 0.3833, h * 0.9317);
	c.close();
	c.moveTo(w * 0.796, h * 0.4608);
	c.lineTo(w * 0.9639, h * 0.4469);
	c.lineTo(w, h * 0.3691);
	c.lineTo(w, h * 0.9077);
	c.lineTo(w * 0.9686, h * 0.9856);
	c.lineTo(w * 0.796, h);
	c.close();
	c.moveTo(w * 0.3378, h * 0.0608);
	c.lineTo(w * 0.3378, h * 0.0907);
	c.lineTo(w * 0.3197, h * 0.1008);
	c.close();
	c.moveTo(w * 0.8502, h * 0.2843);
	c.lineTo(w * 0.8502, h * 0.3083);
	c.lineTo(w * 0.794, h * 0.3136);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.6541);
	c.lineTo(0, h * 0.0933);
	c.lineTo(w * 0.1371, h * 0.1573);
	c.lineTo(w * 0.1371, h * 0.7157);
	c.close();
	c.moveTo(w * 0.1485, h * 0.8219);
	c.lineTo(w * 0.1485, h * 0.2864);
	c.lineTo(w * 0.3846, h * 0.3941);
	c.lineTo(w * 0.3846, h * 0.9317);
	c.close();
	c.moveTo(w * 0.6642, h * 0.9392);
	c.lineTo(w * 0.6642, h * 0.4011);
	c.lineTo(w * 0.796, h * 0.4597);
	c.lineTo(w * 0.796, h);
	c.close();
	c.moveTo(w * 0.1371, h * 0.7157);
	c.lineTo(w * 0.1371, h * 0.1568);
	c.lineTo(w * 0.2027, h * 0.1525);
	c.lineTo(w * 0.1498, h * 0.1771);
	c.lineTo(w * 0.1498, h * 0.7061);
	c.close();
	c.moveTo(w * 0.3846, h * 0.3941);
	c.lineTo(w * 0.614, h * 0.3941);
	c.lineTo(w * 0.6809, h * 0.3632);
	c.lineTo(w * 0.6642, h * 0.4);
	c.lineTo(w * 0.6642, h * 0.9067);
	c.lineTo(w * 0.6191, h * 0.9317);
	c.lineTo(w * 0.3833, h * 0.9317);
	c.close();
	c.moveTo(w * 0.796, h * 0.4608);
	c.lineTo(w * 0.9639, h * 0.4469);
	c.lineTo(w, h * 0.3691);
	c.lineTo(w, h * 0.9077);
	c.lineTo(w * 0.9686, h * 0.9856);
	c.lineTo(w * 0.796, h);
	c.close();
	c.moveTo(w * 0.3378, h * 0.0608);
	c.lineTo(w * 0.3378, h * 0.0907);
	c.lineTo(w * 0.3197, h * 0.1008);
	c.close();
	c.moveTo(w * 0.8502, h * 0.2843);
	c.lineTo(w * 0.8502, h * 0.3083);
	c.lineTo(w * 0.794, h * 0.3136);
	c.close();
	c.moveTo(w * 0.6167, h * 0.3941);
	c.lineTo(w * 0.6167, h * 0.9317);
	c.moveTo(w * 0.9652, h * 0.4448);
	c.lineTo(w * 0.9652, h * 0.9851);
	c.stroke();

	c.restore();
	c.setShadow(false);
	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
	c.setFillColor(strokeColor);
	
	c.begin();
	c.moveTo(w * 0.4903, h * 0.1259);
	c.arcTo(w * 0.01, h * 0.008, 0, 0, 1, w * 0.5023, h * 0.1189);
	c.arcTo(w * 0.2007, h * 0.16, 0, 0, 1, w * 0.5639, h * 0.1333);
	c.arcTo(w * 0.602, h * 0.48, 0, 0, 1, w * 0.7157, h * 0.2005);
	c.arcTo(w * 0.2006, h * 0.16, 0, 0, 1, w * 0.7565, h * 0.2315);
	c.arcTo(w * 0.01, h * 0.008, 0, 0, 1, w * 0.7445, h * 0.2421);
	c.arcTo(w * 0.2676, h * 0.2133, 0, 0, 1, w * 0.6742, h * 0.2251);
	c.arcTo(w * 0.602, h * 0.48, 0, 0, 1, w * 0.5204, h * 0.1541);
	c.arcTo(w * 0.1338, h * 0.1067, 0, 0, 1, w * 0.4903, h * 0.1259);
	c.close();
	c.moveTo(w * 0.4789, h * 0.1275);
	c.arcTo(w * 0.0334, h * 0.0267, 0, 0, 0, w * 0.487, h * 0.1461);
	c.arcTo(w * 0.1672, h * 0.1333, 0, 0, 0, w * 0.5237, h * 0.1728);
	c.arcTo(w * 0.6689, h * 0.5333, 0, 0, 0, w * 0.6609, h * 0.2352);
	c.arcTo(w * 0.2676, h * 0.2133, 0, 0, 0, w * 0.7244, h * 0.2501);
	c.arcTo(w * 0.0201, h * 0.016, 0, 0, 0, w * 0.7411, h * 0.2475);
	c.lineTo(w * 0.5385, h * 0.3408);
	c.arcTo(w * 0.0669, h * 0.05333, 0, 0, 1, w * 0.512, h * 0.3397);
	c.arcTo(w * 0.2676, h * 0.2133, 0, 0, 1, w * 0.4548, h * 0.3248);
	c.arcTo(w * 0.6689, h * 0.5333, 0, 0, 1, w * 0.3084, h * 0.2565);
	c.arcTo(w * 0.1672, h * 0.1333, 0, 0, 1, w * 0.2776, h * 0.2304);
	c.arcTo(w * 0.01, h * 0.008, 0, 0, 1, w * 0.2776, h * 0.2197);
	c.close();
	c.fill();

	var fillColor = mxUtils.getValue(this.state.style, 'fillColor', '#ffffff');
	c.setFillColor(fillColor);
	c.setLineJoin('round');
	c.setLineCap('round');
	c.begin();
	c.moveTo(w * 0.3398, h * 0.2421);
	c.lineTo(w * 0.4769, h * 0.1797);
	c.lineTo(w * 0.6341, h * 0.2512);
	c.lineTo(w * 0.4936, h * 0.3147);
	c.fill();

	c.begin();
	c.moveTo(w * 0.4334, h * 0.1941);
	c.lineTo(w * 0.6207, h * 0.2811);
	c.moveTo(w * 0.5338, h * 0.1995);
	c.lineTo(w * 0.3866, h * 0.2688);
	c.moveTo(w * 0.5873, h * 0.2235);
	c.lineTo(w * 0.4334, h * 0.2955);
	c.stroke();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.6517);
	c.lineTo(0, h * 0.0912);
	c.lineTo(w * 0.0368, h * 0.0155);
	c.lineTo(w * 0.2047, 0);
	c.lineTo(w * 0.3378, h * 0.0619);
	c.lineTo(w * 0.3378, h * 0.0912);
	c.lineTo(w * 0.3819, h * 0.0693);
	c.lineTo(w * 0.6154, h * 0.0693);
	c.lineTo(w * 0.8502, h * 0.1776);
	c.lineTo(w * 0.8502, h * 0.3083);
	c.lineTo(w * 0.8682, h * 0.3061);
	c.lineTo(w, h * 0.3664);
	c.lineTo(w, h * 0.9099);
	c.lineTo(w * 0.9672, h * 0.9861);
	c.lineTo(w * 0.7926, h);
	c.lineTo(w * 0.6629, h * 0.9392);
	c.lineTo(w * 0.6629, h * 0.9099);
	c.lineTo(w * 0.6167, h * 0.9317);
	c.lineTo(w * 0.3813, h * 0.9317);
	c.lineTo(w * 0.1478, h * 0.8219);
	c.lineTo(w * 0.1478, h * 0.7093);
	c.lineTo(w * 0.1365, h * 0.7163);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dRedshift.prototype.cst.REDSHIFT, mxShapeAws3dRedshift);

//**********************************************************************************************************************************************************
//Lambda
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dLambda(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dLambda, mxShape);

mxShapeAws3dLambda.prototype.cst = {
		LAMBDA : 'mxgraph.aws3d.lambda',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dLambda.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 92;
	var strokeWidth2 = strokeWidth * h / 109.5;
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);

	this.background(c, 0, 0, w, h, strokeWidth);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h, strokeWidth);
};

mxShapeAws3dLambda.prototype.background = function(c, x, y, w, h, strokeWidth)
{
	c.setStrokeWidth(strokeWidth);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.1671);
	c.lineTo(w * 0.3424, 0);
	c.lineTo(w * 0.663, 0);
	c.lineTo(w, h * 0.1671);
	c.lineTo(w, h * 0.8365);
	c.lineTo(w * 0.663, h);
	c.lineTo(w * 0.3424, h);
	c.lineTo(0, h * 0.8365);
	c.close();
	c.fillAndStroke();
};

mxShapeAws3dLambda.prototype.foreground = function(c, x, y, w, h, strokeWidth)
{
	c.restore();
	c.setShadow(false);
	c.setFillColor('#000000');
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dLambda.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(0, h * 0.3242);
	c.lineTo(w * 0.3424, h * 0.4895);
	c.lineTo(w * 0.663, h * 0.4895);
	c.lineTo(w * 0.663, h);
	c.lineTo(w * 0.3424, h);
	c.lineTo(0, h * 0.8365);
	c.close();
	c.moveTo(w * 0., h * 0.);
	c.lineTo(w * 0., h * 0.);
	c.lineTo(w * 0., h * 0.);
	c.lineTo(w * 0., h * 0.);
	c.lineTo(w * 0., h * 0.);
	c.lineTo(w * 0., h * 0.);
	c.close();
	c.moveTo(w * 0., h * 0.);
	c.lineTo(w * 0., h * 0.);
	c.lineTo(w * 0., h * 0.);
	c.lineTo(w * 0., h * 0.);
	c.lineTo(w * 0., h * 0.);
	c.lineTo(w * 0., h * 0.);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.663, h * 0.4895);
	c.lineTo(w, h * 0.3242);
	c.lineTo(w, h * 0.8365);
	c.lineTo(w * 0.663, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setShadow(false);
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(0, h * 0.3242);
	c.lineTo(w * 0.3424, h * 0.4895);
	c.lineTo(w * 0.663, h * 0.4895);
	c.lineTo(w, h * 0.3242);
	c.moveTo(w * 0.3424, h * 0.4895);
	c.lineTo(w * 0.3424, h);
	c.moveTo(w * 0.663, h * 0.4895);
	c.lineTo(w * 0.663, h);
	c.stroke();

	c.setFillColor("#5E5E5E");
	
	c.begin();
	c.moveTo(w * 0.3804, h * 0.1169);
	c.arcTo(w * 0.5435, h * 0.4566, 0, 0, 1, w * 0.6087, h * 0.1123);
	c.arcTo(w * 0.33804, h * 0.3196, 0, 0, 1, w * 0.725, h * 0.1553);
	c.arcTo(w * 0.1304, h * 0.1096, 0, 0, 1, w * 0.7924, h * 0.2402);
	c.arcTo(w * 0.1522, h * 0.1279, 0, 0, 1, w * 0.725, h * 0.3333);
	c.arcTo(w * 0.4416, h * 0.274, 0, 0, 1, w * 0.6087, h * 0.3772);
	c.arcTo(w * 0.5435, h * 0.4566, 0, 0, 1, w * 0.3804, h * 0.3708);
	c.arcTo(w * 0.3804, h * 0.3196, 0, 0, 1, w * 0.2772, h * 0.3324);
	c.arcTo(w * 0.1522, h * 0.1279, 0, 0, 1, w * 0.2163, h * 0.2539);
	c.arcTo(w * 0.1522, h * 0.1279, 0, 0, 1, w * 0.2663, h * 0.1644);
	c.arcTo(w * 0.3804, h * 0.3196, 0, 0, 1, w * 0.3804, h * 0.1169);
	c.fill();

	c.setFillColor("#ffffff");

	c.begin();
	c.moveTo(w * 0.5565, h * 0.2174);
	c.arcTo(w * 0.0652, h * 0.0548, 0, 0, 0, w * 0.5837, h * 0.1945);
	c.arcTo(w * 0.0326, h * 0.0274, 0, 0, 0, w * 0.5793, h * 0.1671);
	c.arcTo(w * 0.0652, h * 0.0548, 0, 0, 0, w * 0.525, h * 0.1598);
	c.arcTo(w * 0.0652, h * 0.0548, 0, 0, 1, w * 0.5543, h * 0.1443);
	c.arcTo(w * 0.0761, h * 0.0639, 0, 0, 1, w * 0.6163, h * 0.1662);
	c.arcTo(w * 0.0598, h * 0.0502, 0, 0, 1, w * 0.6087, h * 0.2091);
	c.lineTo(w * 0.5, h * 0.3032);
	c.arcTo(w * 0.0978, h * 0.0822, 0, 0, 0, w * 0.4728, h * 0.3379);
	c.arcTo(w * 0.0272, h * 0.0228, 0, 0, 0, w * 0.4924, h * 0.3571);
	c.arcTo(w * 0.0326, h * 0.0274, 0, 0, 1, w * 0.4489, h * 0.3571);
	c.arcTo(w * 0.038, h * 0.032, 0, 0, 1, w * 0.437, h * 0.3242);
	c.arcTo(w * 0.1087, h * 0.0913, 0, 0, 1, w * 0.4674, h * 0.2886);
	c.lineTo(w * 0.5141, h * 0.2557);
	c.lineTo(w * 0.3185, h * 0.2895);
	c.lineTo(w * 0.2641, h * 0.2648);
	c.close();
	c.fill();

	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');

	c.begin();
	c.moveTo(0, h * 0.1671);
	c.lineTo(w * 0.3424, 0);
	c.lineTo(w * 0.663, 0);
	c.lineTo(w, h * 0.1671);
	c.lineTo(w, h * 0.8365);
	c.lineTo(w * 0.663, h);
	c.lineTo(w * 0.3424, h);
	c.lineTo(0, h * 0.8365);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dLambda.prototype.cst.LAMBDA, mxShapeAws3dLambda);

//**********************************************************************************************************************************************************
//EBS 2
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeAws3dEbs2(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeAws3dEbs2, mxShape);

mxShapeAws3dEbs2.prototype.cst = {
		EBS2 : 'mxgraph.aws3d.ebs2',
		SHADING_COLORS : 'shadingCols'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeAws3dEbs2.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
	var strokeWidth1 = strokeWidth * w / 92;
	var strokeWidth2 = strokeWidth * h / 60;
	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
	
	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
	
	c.setStrokeWidth(strokeWidth);
	c.setShadow(false);
	c.save();
	c.save();
	c.setStrokeWidth(2 * strokeWidth);
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	if(isShadow == 1)
	{
		c.setShadow(true);
	}
	
	c.begin();
	c.moveTo(0, h * 0.5276);
	c.lineTo(0, h * 0.4188);
	c.lineTo(w * 0.071, h * 0.2898);
	c.lineTo(w * 0.4033, 0);
	c.lineTo(w * 0.9301, h * 0.464);
	c.lineTo(w, h * 0.5863);
	c.lineTo(w, h * 0.7035);
	c.lineTo(w * 0.6667, h);
	c.lineTo(w * 0.5355, h);
	c.close();
	c.fillAndStroke();
	
	c.restore();
	c.setFillColor('#000000');
	
	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dEbs2.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
	
	c.begin();
	c.moveTo(w * 0.071, h * 0.2948);
	c.lineTo(w * 0.6011, h * 0.7621);
	c.lineTo(w * 0.6667, h);
	c.lineTo(w * 0.5355, h);
	c.lineTo(0, h * 0.5276);
	c.lineTo(0, h * 0.4137);
	c.close();
	c.fill();

	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
	c.begin();
	c.moveTo(w * 0.6011, h * 0.7655);
	c.lineTo(w * 0.9344, h * 0.4724);
	c.lineTo(w, h * 0.7035);
	c.lineTo(w * 0.6667, h);
	c.close();
	c.fill();
	
	c.restore();
	c.setLineJoin('round');
	
	c.begin();
	c.moveTo(w * 0.071, h * 0.2948);
	c.lineTo(w * 0.6011, h * 0.7621);
	c.lineTo(w * 0.6667, h);
	c.lineTo(w * 0.5355, h);
	c.lineTo(0, h * 0.5276);
	c.lineTo(0, h * 0.4137);
	c.close();
	c.moveTo(w * 0.6011, h * 0.7655);
	c.lineTo(w * 0.9344, h * 0.4724);
	c.lineTo(w, h * 0.7035);
	c.lineTo(w * 0.6667, h);
	c.close();
	c.moveTo(w * 0.0033, h * 0.5276);
	c.lineTo(w * 0.071, h * 0.2898);
	c.moveTo(w * 0.5325, h * 0.9976);
	c.lineTo(w * 0.603, h * 0.7593);
	c.stroke();

	c.setStrokeWidth(2 * strokeWidth);
	c.setLineCap('round');
	
	c.begin();
	c.moveTo(w * 0.3388, h * 0.3802);
	c.lineTo(w * 0.5027, h * 0.2345);
	c.lineTo(w * 0.6667, h * 0.3802);
	c.lineTo(w * 0.5027, h * 0.526);
	c.close();
	c.moveTo(w * 0.4426, h * 0.3802);
	c.lineTo(w * 0.5027, h * 0.3266);
	c.lineTo(w * 0.5628, h * 0.3802);
	c.lineTo(w * 0.5027, h * 0.4338);
	c.close();
	c.moveTo(w * 0.3867, h * 0.3284);
	c.lineTo(w * 0.3541, h * 0.2998);
	c.moveTo(w * 0.4436, h * 0.2748);
	c.lineTo(w * 0.4077, h * 0.2412);
	c.moveTo(w * 0.5704, h * 0.2803);
	c.lineTo(w * 0.5992, h * 0.2513);
	c.moveTo(w * 0.6231, h * 0.3284);
	c.lineTo(w * 0.6503, h * 0.3032);
	c.moveTo(w * 0.622, h * 0.4338);
	c.lineTo(w * 0.6557, h * 0.4606);
	c.moveTo(w * 0.5667, h * 0.4845);
	c.lineTo(w * 0.5992, h * 0.5156);
	c.moveTo(w * 0.4414, h * 0.4874);
	c.lineTo(w * 0.412, h * 0.5159);
	c.moveTo(w * 0.3889, h * 0.4405);
	c.lineTo(w * 0.3607, h * 0.4657);
	c.stroke();
	
	c.setStrokeColor('#292929');
	c.setLineJoin('round');

	c.begin();
	c.moveTo(0, h * 0.5276);
	c.lineTo(0, h * 0.4188);
	c.lineTo(w * 0.071, h * 0.2898);
	c.lineTo(w * 0.4033, 0);
	c.lineTo(w * 0.9301, h * 0.464);
	c.lineTo(w, h * 0.5863);
	c.lineTo(w, h * 0.7035);
	c.lineTo(w * 0.6667, h);
	c.lineTo(w * 0.5355, h);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeAws3dEbs2.prototype.cst.EBS2, mxShapeAws3dEbs2);

//**********************************************************************************************************************************************************
//Elasticache
//**********************************************************************************************************************************************************
///**
//* Extends mxShape.
//*/
//function mxShapeAws3dElasticache(bounds, fill, stroke, strokewidth)
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
//mxUtils.extend(mxShapeAws3dElasticache, mxShape);
//
//mxShapeAws3dElasticache.prototype.cst = {
//		ELASTICACHE : 'mxgraph.aws3d.elasticache',
//		SHADING_COLORS : 'shadingCols'
//};
//
///**
//* Function: paintVertexShape
//* 
//* Paints the vertex shape.
//*/
//mxShapeAws3dElasticache.prototype.paintVertexShape = function(c, x, y, w, h)
//{
//	c.translate(x, y);
//
//	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
//	var strokeWidth1 = strokeWidth * w / 123;
//	var strokeWidth2 = strokeWidth * h / 143;
//	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
//	
//	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
//	
//	c.setStrokeWidth(strokeWidth);
//	c.setShadow(false);
//	c.save();
//	c.save();
//	c.setStrokeWidth(2 * strokeWidth);
//	c.setStrokeColor('#292929');
//	c.setLineJoin('round');
//
//	if(isShadow == 1)
//	{
//		c.setShadow(true);
//	}
//	
//	c.begin();
//	c.moveTo(0, h * 0.7483);
//	c.lineTo(0, h * 0.6294);
//	c.lineTo(w * 0.061, h * 0.5944);
//	c.lineTo(0, h * 0.563);
//	c.lineTo(0, h * 0.4406);
//	c.lineTo(w * 0.061, h * 0.4091);
//	c.lineTo(0, h * 0.3776);
//	c.lineTo(0, h * 0.2517);
//	c.lineTo(w * 0.5041, 0);
//	c.lineTo(w, h * 0.2483);
//	c.lineTo(w, h * 0.3741);
//	c.lineTo(w * 0.939, h * 0.4091);
//	c.lineTo(w, h * 0.4406);
//	c.lineTo(w, h * 0.563);
//	c.lineTo(w * 0.939, h * 0.5944);
//	c.lineTo(w, h * 0.6294);
//	c.lineTo(w, h * 0.751);
//	c.lineTo(w * 0.5041, h);
//	c.close();
//	c.fillAndStroke();
//	
//	c.restore();
//	c.setFillColor('#000000');
//	
//	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dElasticache.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
//	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
//	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
//	
//	c.begin();
//	c.moveTo(0, h * 0.2517);
//	c.lineTo(w * 0.5041, h * 0.4965);
//	c.lineTo(w * 0.5041, h * 0.6294);
//	c.lineTo(0, h * 0.3776);
//	c.close();
//	c.moveTo(0, h * 0.4406);
//	c.lineTo(w * 0.5041, h * 0.6853);
//	c.lineTo(w * 0.5041, h * 0.8112);
//	c.lineTo(0, h * 0.5629);
//	c.close();
//	c.moveTo(0, h * 0.6294);
//	c.lineTo(w * 0.5041, h * 0.8741);
//	c.lineTo(w * 0.5041, h);
//	c.lineTo(0, h * 0.7483);
//	c.close();
//	c.moveTo(w * 0.6179, h * 0.2517);
//	c.lineTo(w * 0.752, h * 0.1853);
//	c.lineTo(w * 0.752, h * 0.3217);
//	c.close();
//	c.fill();
//
//	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
//	c.begin();
//	c.moveTo(w * 0.5041, h * 0.4965);
//	c.lineTo(w, h * 0.2517);
//	c.lineTo(w, h * 0.3741);
//	c.lineTo(w * 0.5041, h * 0.6294);
//	c.close();
//	c.moveTo(w * 0.5041, h * 0.6853);
//	c.lineTo(w, h * 0.4406);
//	c.lineTo(w, h * 0.5629);
//	c.lineTo(w * 0.5041, h * 0.8112);
//	c.close();
//	c.moveTo(w * 0.5041, h * 0.8741);
//	c.lineTo(w, h * 0.6294);
//	c.lineTo(w, h * 0.7483);
//	c.lineTo(w * 0.5041, h);
//	c.close();
//	c.moveTo(w * 0.752, h * 0.1853);
//	c.lineTo(w * 0.8821, h * 0.2517);
//	c.lineTo(w * 0.752, h * 0.3217);
//	c.close();
//	c.fill();
//	
//	c.restore();
//	c.setLineJoin('round');
//	
//	c.begin();
//	c.moveTo(0, h * 0.2517);
//	c.lineTo(w * 0.5041, h * 0.4965);
//	c.lineTo(w * 0.5041, h * 0.6294);
//	c.lineTo(0, h * 0.3776);
//	c.close();
//	c.moveTo(0, h * 0.4406);
//	c.lineTo(w * 0.5041, h * 0.6853);
//	c.lineTo(w * 0.5041, h * 0.8112);
//	c.lineTo(0, h * 0.5629);
//	c.close();
//	c.moveTo(0, h * 0.6294);
//	c.lineTo(w * 0.5041, h * 0.8741);
//	c.lineTo(w * 0.5041, h);
//	c.lineTo(0, h * 0.7483);
//	c.close();
//	c.moveTo(w * 0.5041, h * 0.4965);
//	c.lineTo(w, h * 0.2517);
//	c.lineTo(w, h * 0.3741);
//	c.lineTo(w * 0.5041, h * 0.6294);
//	c.close();
//	c.moveTo(w * 0.5041, h * 0.6853);
//	c.lineTo(w, h * 0.4406);
//	c.lineTo(w, h * 0.5629);
//	c.lineTo(w * 0.5041, h * 0.8112);
//	c.close();
//	c.moveTo(w * 0.5041, h * 0.8741);
//	c.lineTo(w, h * 0.6294);
//	c.lineTo(w, h * 0.7483);
//	c.lineTo(w * 0.5041, h);
//	c.close();
//	c.stroke();
//
//	c.setStrokeWidth(2 * strokeWidth);
//	c.setLineCap('round');
//	var strokeColor = mxUtils.getValue(this.state.style, 'strokeColor', '#000000');
//	c.setFillColor(strokeColor);
//
//	c.begin();
//	c.moveTo(w * 0.222, h * 0.2028);
//	c.arcTo(w * 0.1463, h * 0.1259, 0, 0, 1, w * 0.3154, h * 0.2014);
//	c.arcTo(w * 0.122, h * 0.1049, 0, 0, 1, w * 0.3642, h * 0.2245);
//	c.arcTo(w * 0.0325, h * 0.028, 0, 0, 1, w * 0.3618, h * 0.2552);
//	c.arcTo(w * 0.122, h * 0.1049, 0, 0, 1, w * 0.3252, h * 0.2798);
//	c.arcTo(w * 0.1626, h * 0.1399, 0, 0, 1, w * 0.2276, h * 0.2797);
//	c.arcTo(w * 0.0976, h * 0.0839, 0, 0, 1, w * 0.187, h * 0.2622);
//	c.arcTo(w * 0.0325, h * 0.028, 0, 0, 1, w * 0.187, h * 0.2238);
//	c.arcTo(w * 0.0976, h * 0.0839, 0, 0, 1, w * 0.222, h * 0.2028);
//	c.close();
//	c.moveTo(w * 0.3618, h * 0.1434);
//	c.lineTo(w * 0.4309, h * 0.1189);
//	c.lineTo(w * 0.4309, h * 0.0755);
//	c.lineTo(w * 0.4992, h * 0.1014);
//	c.lineTo(w * 0.5813, h * 0.0874);
//	c.lineTo(w * 0.5488, h * 0.1294);
//	c.lineTo(w * 0.6057, h * 0.1608);
//	c.lineTo(w * 0.5163, h * 0.1608);
//	c.lineTo(w * 0.4634, h * 0.2028);
//	c.lineTo(w * 0.4431, h * 0.1538);
//	c.close();
//	c.moveTo(w * 0.3821, h * 0.3601);
//	c.lineTo(w * 0.5894, h * 0.3322);
//	c.lineTo(w * 0.5325, h * 0.4394);
//	c.close();
//	c.fill();
//	
//	c.setStrokeColor('#292929');
//	c.setLineJoin('round');
//
//	c.begin();
//	c.moveTo(0, h * 0.7483);
//	c.lineTo(0, h * 0.6294);
//	c.lineTo(w * 0.061, h * 0.5944);
//	c.lineTo(0, h * 0.563);
//	c.lineTo(0, h * 0.4406);
//	c.lineTo(w * 0.061, h * 0.4091);
//	c.lineTo(0, h * 0.3776);
//	c.lineTo(0, h * 0.2517);
//	c.lineTo(w * 0.5041, 0);
//	c.lineTo(w, h * 0.2483);
//	c.lineTo(w, h * 0.3741);
//	c.lineTo(w * 0.939, h * 0.4091);
//	c.lineTo(w, h * 0.4406);
//	c.lineTo(w, h * 0.563);
//	c.lineTo(w * 0.939, h * 0.5944);
//	c.lineTo(w, h * 0.6294);
//	c.lineTo(w, h * 0.751);
//	c.lineTo(w * 0.5041, h);
//	c.close();
//	c.stroke();
//};
//
//mxCellRenderer.registerShape(mxShapeAws3dElasticache.prototype.cst.ELASTICACHE, mxShapeAws3dElasticache);

//**********************************************************************************************************************************************************
//Kinesis Stream
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
//function mxShapeAws3dKinesisStream(bounds, fill, stroke, strokewidth)
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
//mxUtils.extend(mxShapeAws3dKinesisStream, mxShape);
//
//mxShapeAws3dKinesisStream.prototype.cst = {
//		KINESIS_STREAM : 'mxgraph.aws3d.kinesisStream',
//		SHADING_COLORS : 'shadingCols'
//};
//
///**
//* Function: paintVertexShape
//* 
//* Paints the vertex shape.
//*/
//mxShapeAws3dKinesisStream.prototype.paintVertexShape = function(c, x, y, w, h)
//{
//	c.translate(x, y);
//
//	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
//	var strokeWidth1 = strokeWidth * w / 220;
//	var strokeWidth2 = strokeWidth * h / 160;
//	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
//	
//	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
//	
//	c.setStrokeWidth(strokeWidth);
//	c.setShadow(false);
//	c.save();
//	c.save();
//	c.setStrokeWidth(2 * strokeWidth);
//	c.setStrokeColor('#292929');
//	c.setLineJoin('round');
//
//	if(isShadow == 1)
//	{
//		c.setShadow(true);
//	}
//	
//	c.begin();
//	c.moveTo(0, h * 0.5503);
//	c.lineTo(w * 0.0455, h * 0.4623);
//	c.lineTo(w * 0.6054, h * 0.0157);
//	c.lineTo(w * 0.6623, h * 0.0629);
//	c.lineTo(w * 0.7396, 0);
//	c.lineTo(w * 0.8239, h * 0.0692);
//	c.lineTo(w * 0.8671, h * 0.2233);
//	c.lineTo(w * 0.9513, h * 0.2943);
//	c.lineTo(w, h * 0.4528);
//	c.lineTo(w * 0.9595, h * 0.5365);
//	c.lineTo(w * 0.396, h * 0.9843);
//	c.lineTo(w * 0.3391, h * 0.9403);
//	c.lineTo(w * 0.2617, h);
//	c.lineTo(w * 0.173, h * 0.9308);
//	c.lineTo(w * 0.1297, h * 0.7736);
//	c.lineTo(w * 0.0432, h * 0.7044);
//	c.close();
//	c.fillAndStroke();
//	
//	c.restore();
//	c.setFillColor('#000000');
//	
//	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dKinesisStream.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
//	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
//	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
//	
//	c.begin();
//	c.moveTo(w * 0.0432, h * 0.4654);
//	c.lineTo(w * 0.132, h * 0.5314);
//	c.lineTo(w * 0.1775, h * 0.4465);
//	c.lineTo(w * 0.264, h * 0.5189);
//	c.lineTo(w * 0.3072, h * 0.673);
//	c.lineTo(w * 0.396, h * 0.7453);
//	c.lineTo(w * 0.4392, h * 0.8994);
//	c.lineTo(w * 0.396, h * 0.9843);
//	c.lineTo(w * 0.305, h * 0.9151);
//	c.lineTo(w * 0.2617, h);
//	c.lineTo(w * 0.173, h * 0.9308);
//	c.lineTo(w * 0.1297, h * 0.7736);
//	c.lineTo(w * 0.0432, h * 0.7044);
//	c.lineTo(0, h * 0.5503);
//	c.close();
//	c.fill();
//
//	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
//	c.begin();
//	c.moveTo(w * 0.264, h * 0.5204);
//	c.lineTo(w * 0.8239, h * 0.0676);
//	c.lineTo(w * 0.8694, h * 0.228);
//	c.lineTo(w * 0.3072, h * 0.673);
//	c.close();
//	c.moveTo(w * 0.3937, h * 0.7453);
//	c.lineTo(w * 0.9536, h * 0.2956);
//	c.lineTo(w, h * 0.4528);
//	c.lineTo(w * 0.9558, h * 0.5377);
//	c.lineTo(w * 0.396, h * 0.9843);
//	c.lineTo(w * 0.4392, h * 0.8994);
//	c.close();
//	c.moveTo(w * 0.2617, h);
//	c.lineTo(w * 0.305, h * 0.9151);
//	c.lineTo(w * 0.3368, h * 0.9403);
//	c.close();
//	c.fill();
//	
//	c.setAlpha('0.5');
//	c.begin();
//	c.moveTo(w * 0.0546, h * 0.5094);
//	c.lineTo(w * 0.1161, h * 0.5597);
//	c.lineTo(w * 0.1479, h * 0.6761);
//	c.lineTo(w * 0.1183, h * 0.7264);
//	c.lineTo(w * 0.0569, h * 0.6792);
//	c.lineTo(w * 0.025, h * 0.566);
//	c.close();
//	c.moveTo(w * 0.1889, h * 0.4937);
//	c.lineTo(w * 0.2503, h * 0.544);
//	c.lineTo(w * 0.2822, h * 0.6572);
//	c.lineTo(w * 0.2526, h * 0.717);
//	c.lineTo(w * 0.1934, h * 0.6667);
//	c.lineTo(w * 0.1593, h * 0.5566);
//	c.close();
//	c.moveTo(w * 0.3195, h * 0.7201);
//	c.lineTo(w * 0.3801, h * 0.7704);
//	c.lineTo(w * 0.4137, h * 0.8805);
//	c.lineTo(w * 0.3819, h * 0.9403);
//	c.lineTo(w * 0.3209, h * 0.8912);
//	c.lineTo(w * 0.2904, h * 0.783);
//	c.close();
//	c.moveTo(w * 0.1866, h * 0.7358);
//	c.lineTo(w * 0.2458, h * 0.783);
//	c.lineTo(w * 0.2776, h * 0.8962);
//	c.lineTo(w * 0.2481, h * 0.956);
//	c.lineTo(w * 0.1866, h * 0.9057);
//	c.lineTo(w * 0.157, h * 0.7893);
//	c.close();
//	c.fill();
//
//	c.restore();
//	c.setLineJoin('round');
//	
//	c.begin();
//	c.moveTo(w * 0.0432, h * 0.4654);
//	c.lineTo(w * 0.132, h * 0.5314);
//	c.lineTo(w * 0.1775, h * 0.4465);
//	c.lineTo(w * 0.264, h * 0.5189);
//	c.lineTo(w * 0.3072, h * 0.673);
//	c.lineTo(w * 0.396, h * 0.7453);
//	c.lineTo(w * 0.4392, h * 0.8994);
//	c.lineTo(w * 0.396, h * 0.9843);
//	c.lineTo(w * 0.305, h * 0.9151);
//	c.lineTo(w * 0.2617, h);
//	c.lineTo(w * 0.173, h * 0.9308);
//	c.lineTo(w * 0.1297, h * 0.7736);
//	c.lineTo(w * 0.0432, h * 0.7044);
//	c.lineTo(0, h * 0.5503);
//	c.close();
//	c.moveTo(w * 0.264, h * 0.5204);
//	c.lineTo(w * 0.8239, h * 0.0676);
//	c.lineTo(w * 0.8694, h * 0.228);
//	c.lineTo(w * 0.3072, h * 0.673);
//	c.close();
//	c.moveTo(w * 0.3937, h * 0.7453);
//	c.lineTo(w * 0.9536, h * 0.2956);
//	c.lineTo(w, h * 0.4528);
//	c.lineTo(w * 0.9558, h * 0.5377);
//	c.lineTo(w * 0.396, h * 0.9843);
//	c.lineTo(w * 0.4392, h * 0.8994);
//	c.close();
//	c.moveTo(w * 0.2617, h);
//	c.lineTo(w * 0.305, h * 0.9151);
//	c.lineTo(w * 0.3368, h * 0.9403);
//	c.close();
//	c.moveTo(w * 0.0546, h * 0.5094);
//	c.lineTo(w * 0.1161, h * 0.5597);
//	c.lineTo(w * 0.1479, h * 0.6761);
//	c.lineTo(w * 0.1183, h * 0.7264);
//	c.lineTo(w * 0.0569, h * 0.6792);
//	c.lineTo(w * 0.025, h * 0.566);
//	c.close();
//	c.moveTo(w * 0.1889, h * 0.4937);
//	c.lineTo(w * 0.2503, h * 0.544);
//	c.lineTo(w * 0.2822, h * 0.6572);
//	c.lineTo(w * 0.2526, h * 0.717);
//	c.lineTo(w * 0.1934, h * 0.6667);
//	c.lineTo(w * 0.1593, h * 0.5566);
//	c.close();
//	c.moveTo(w * 0.3195, h * 0.7201);
//	c.lineTo(w * 0.3801, h * 0.7704);
//	c.lineTo(w * 0.4137, h * 0.8805);
//	c.lineTo(w * 0.3819, h * 0.9403);
//	c.lineTo(w * 0.3209, h * 0.8912);
//	c.lineTo(w * 0.2904, h * 0.783);
//	c.close();
//	c.moveTo(w * 0.1866, h * 0.7358);
//	c.lineTo(w * 0.2458, h * 0.783);
//	c.lineTo(w * 0.2776, h * 0.8962);
//	c.lineTo(w * 0.2481, h * 0.956);
//	c.lineTo(w * 0.1866, h * 0.9057);
//	c.lineTo(w * 0.157, h * 0.7893);
//	c.close();
//	c.moveTo(w * 0.1775, h * 0.4465);
//	c.lineTo(w * 0.7374, 0);
//	c.moveTo(w * 0.4392, h * 0.8994);
//	c.lineTo(w, h * 0.4528);
//	c.moveTo(w * 0.1331, h * 0.533);
//	c.lineTo(w * 0.1809, h * 0.6934);
//	c.lineTo(w * 0.2617, h * 0.7626);
//	c.lineTo(w * 0.3061, h * 0.9151);
//	c.moveTo(w * 0.1295, h * 0.7764);
//	c.lineTo(w * 0.1807, h * 0.6928);
//	c.moveTo(w * 0.264, h * 0.7642);
//	c.lineTo(w * 0.3095, h * 0.673);
//	c.moveTo(w * 0.3641, h * 0.2327);
//	c.lineTo(w * 0.3241, h * 0.2673);
//	c.lineTo(w * 0.3619, h * 0.2987);
//	c.moveTo(w * 0.3468, h * 0.2736);
//	c.lineTo(w * 0.3596, h * 0.261);
//	c.moveTo(w * 0.3573, h * 0.283);
//	c.lineTo(w * 0.3823, h * 0.261);
//	c.moveTo(w * 0.4916, h * 0.217);
//	c.lineTo(w * 0.4483, h * 0.2547);
//	c.lineTo(w * 0.5052, h * 0.3019);
//	c.moveTo(w * 0.4679, h * 0.2591);
//	c.lineTo(w * 0.4802, h * 0.2478);
//	c.moveTo(w * 0.4811, h * 0.2673);
//	c.lineTo(w * 0.5098, h * 0.2421);
//	c.moveTo(w * 0.4939, h * 0.2767);
//	c.lineTo(w * 0.5121, h * 0.261);
//	c.moveTo(w * 0.5043, h * 0.2868);
//	c.lineTo(w * 0.5371, h * 0.2579);
//	c.moveTo(w * 0.6259, h * 0.4371);
//	c.lineTo(w * 0.5826, h * 0.4717);
//	c.lineTo(w * 0.6418, h * 0.522);
//	c.moveTo(w * 0.6039, h * 0.4755);
//	c.lineTo(w * 0.6187, h * 0.463);
//	c.moveTo(w * 0.6158, h * 0.4862);
//	c.lineTo(w * 0.6418, h * 0.4623);
//	c.moveTo(w * 0.6281, h * 0.4969);
//	c.lineTo(w * 0.6486, h * 0.478);
//	c.moveTo(w * 0.6395, h * 0.5063);
//	c.lineTo(w * 0.6736, h * 0.478);
//	
//	c.stroke();
//
//	c.setStrokeWidth(2 * strokeWidth);
//	c.setLineCap('round');
//
//	c.setStrokeColor('#292929');
//	c.setLineJoin('round');
//
//	c.begin();
//	c.moveTo(0, h * 0.5503);
//	c.lineTo(w * 0.0455, h * 0.4623);
//	c.lineTo(w * 0.6054, h * 0.0157);
//	c.lineTo(w * 0.6623, h * 0.0629);
//	c.lineTo(w * 0.7396, 0);
//	c.lineTo(w * 0.8239, h * 0.0692);
//	c.lineTo(w * 0.8671, h * 0.2233);
//	c.lineTo(w * 0.9513, h * 0.2943);
//	c.lineTo(w, h * 0.4528);
//	c.lineTo(w * 0.9595, h * 0.5365);
//	c.lineTo(w * 0.396, h * 0.9843);
//	c.lineTo(w * 0.3391, h * 0.9403);
//	c.lineTo(w * 0.2617, h);
//	c.lineTo(w * 0.173, h * 0.9308);
//	c.lineTo(w * 0.1297, h * 0.7736);
//	c.lineTo(w * 0.0432, h * 0.7044);
//	c.close();
//	c.stroke();
//};
//
//mxCellRenderer.registerShape(mxShapeAws3dKinesisStream.prototype.cst.KINESIS_STREAM, mxShapeAws3dKinesisStream);

//**********************************************************************************************************************************************************
//SQS 2
//**********************************************************************************************************************************************************
///**
//* Extends mxShape.
//*/
//function mxShapeAws3dSqs2(bounds, fill, stroke, strokewidth)
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
//mxUtils.extend(mxShapeAws3dSqs2, mxShape);
//
//mxShapeAws3dSqs2.prototype.cst = {
//		SQS2 : 'mxgraph.aws3d.sqs2',
//		SHADING_COLORS : 'shadingCols'
//};
//
///**
//* Function: paintVertexShape
//* 
//* Paints the vertex shape.
//*/
//mxShapeAws3dSqs2.prototype.paintVertexShape = function(c, x, y, w, h)
//{
//	c.translate(x, y);
//
//	var strokeWidth = parseFloat(mxUtils.getValue(this.state.style, 'strokeWidth', '1'));
//	var strokeWidth1 = strokeWidth * w / 160;
//	var strokeWidth2 = strokeWidth * h / 93;
//	var isShadow = parseFloat(mxUtils.getValue(this.state.style, 'shadow', '0'));
//	
//	strokeWidth = Math.min(strokeWidth1, strokeWidth2);
//	
//	c.setStrokeWidth(strokeWidth);
//	c.setShadow(false);
//	c.save();
//	c.save();
//	c.setStrokeWidth(2 * strokeWidth);
//	c.setStrokeColor('#292929');
//	c.setLineJoin('round');
//
//	if(isShadow == 1)
//	{
//		c.setShadow(true);
//	}
//	
//	c.begin();
//	c.moveTo(0, h * 0.4737);
//	c.lineTo(w * 0.4652, 0);
//	c.lineTo(w * 0.6231, h * 0.0602);
//	c.lineTo(w * 0.6231, h * 0.1676);
//	c.lineTo(w * 0.1567, h * 0.6316);
//	c.close();
//	c.moveTo(w * 0.3756, h * 0.8443);
//	c.lineTo(w * 0.3756, h * 0.7454);
//	c.lineTo(w * 0.8439, h * 0.275);
//	c.lineTo(w, h * 0.5328);
//	c.lineTo(w * 0.5311, h);
//	c.close();
//	c.fillAndStroke();
//	
//	c.restore();
//	c.setFillColor('#000000');
//	
//	var shading = mxUtils.getValue(this.state.style, mxShapeAws3dSqs2.prototype.cst.SHADING_COLORS, '0.1,0.3').toString().split(',');
//	var flipH = mxUtils.getValue(this.state.style, 'flipH', '0');
//	(flipH == '0') ? c.setAlpha(shading[0]) : c.setAlpha(shading[1]); 
//	
//	c.begin();
//	c.moveTo(0, h * 0.4737);
//	c.lineTo(w * 0.1567, h * 0.5274);
//	c.lineTo(w * 0.1567, h * 0.6394);
//	c.close();
//	c.moveTo(w * 0.3756, h * 0.7454);
//	c.lineTo(w * 0.5311, h);
//	c.lineTo(w * 0.3756, h * 0.8443);
//	c.close();
//	c.fill();
//
//	(flipH == '0') ? c.setAlpha(shading[1]) : c.setAlpha(shading[0]); 
//	c.begin();
//	c.moveTo(w * 0.1567, h * 0.5274);
//	c.lineTo(w * 0.6231, h * 0.0602);
//	c.lineTo(w * 0.6231, h * 0.1676);
//	c.lineTo(w * 0.1567, h * 0.6294);
//	c.close();
//	c.fill();
//	
//	c.restore();
//	c.setLineJoin('round');
//	
//	c.begin();
//	c.moveTo(0, h * 0.4737);
//	c.lineTo(w * 0.1567, h * 0.5274);
//	c.lineTo(w * 0.1567, h * 0.6294);
//	c.close();
//	c.moveTo(w * 0.3756, h * 0.7454);
//	c.lineTo(w * 0.5311, h);
//	c.lineTo(w * 0.3756, h * 0.8443);
//	c.close();
//	c.moveTo(w * 0.1567, h * 0.5274);
//	c.lineTo(w * 0.6231, h * 0.0602);
//	c.lineTo(w * 0.6231, h * 0.1676);
//	c.lineTo(w * 0.1567, h * 0.6294);
//	c.close();
//	c.stroke();
//
//	c.setStrokeWidth(2 * strokeWidth);
//	c.setLineCap('round');
//
//	c.setStrokeColor('#292929');
//	c.setLineJoin('round');
//
//	c.begin();
//	c.moveTo(0, h * 0.4737);
//	c.lineTo(w * 0.4652, 0);
//	c.lineTo(w * 0.6231, h * 0.0602);
//	c.lineTo(w * 0.6231, h * 0.1676);
//	c.lineTo(w * 0.1567, h * 0.6316);
//	c.close();
//	c.moveTo(w * 0.3756, h * 0.8443);
//	c.lineTo(w * 0.3756, h * 0.7454);
//	c.lineTo(w * 0.8439, h * 0.275);
//	c.lineTo(w, h * 0.5328);
//	c.lineTo(w * 0.5311, h);
//	c.close();
//	c.stroke();
//	
//	c.setFillColor('#F4B934');
//	
//	c.begin();
//	c.moveTo(w * 0.1256, h * 0.812);
//	c.lineTo(w * 0.24, h * 0.7605);
//	c.lineTo(w * 0.1853, h * 0.8829);
//	c.close();
//	c.moveTo(w * 0.2417, h * 0.6957);
//	c.lineTo(w * 0.3562, h * 0.6441);
//	c.lineTo(w * 0.3014, h * 0.7666);
//	c.close();
//	c.moveTo(w * 0.3588, h * 0.5793);
//	c.lineTo(w * 0.4733, h * 0.5277);
//	c.lineTo(w * 0.4185, h * 0.6502);
//	c.close();
//	c.moveTo(w * 0.477, h * 0.4611);
//	c.lineTo(w * 0.5914, h * 0.4096);
//	c.lineTo(w * 0.5367, h * 0.532);
//	c.close();
//	c.moveTo(w * 0.591, h * 0.343);
//	c.lineTo(w * 0.7054, h * 0.2914);
//	c.lineTo(w * 0.6507, h * 0.4139);
//	c.close();
//	c.moveTo(w * 0.7091, h * 0.2302);
//	c.lineTo(w * 0.8236, h * 0.1786);
//	c.lineTo(w * 0.7688, h * 0.3011);
//	c.close();
//	c.fillAndStroke();
//};
//
//mxCellRenderer.registerShape(mxShapeAws3dSqs2.prototype.cst.SQS2, mxShapeAws3dSqs2);

