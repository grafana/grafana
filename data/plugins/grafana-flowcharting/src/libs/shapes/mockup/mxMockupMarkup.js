/**
 * $Id: mxMockupMarkup.js,v 1.5 2013/02/27 14:30:39 mate Exp $
 * Copyright (c) 2006-2010, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Horizontal Curly Brace
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupCurlyBrace(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupCurlyBrace, mxShape);

mxShapeMockupCurlyBrace.prototype.cst = {
		SHAPE_CURLY_BRACE : 'mxgraph.mockup.markup.curlyBrace'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupCurlyBrace.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxShapeMockupCurlyBrace.prototype.background = function(c, x, y, w, h)
{
	var midY = h * 0.5;
	var rSize = Math.min(w * 0.125, midY);
	c.begin();
	c.moveTo(0, midY + rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, midY);
	c.lineTo(w * 0.5 - rSize, midY);
	c.arcTo(rSize, rSize, 0, 0, 0, w * 0.5, midY - rSize);
	c.arcTo(rSize, rSize, 0, 0, 0, w * 0.5 + rSize, midY);
	c.lineTo(w - rSize, midY);
	c.arcTo(rSize, rSize, 0, 0, 1, w, midY + rSize);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupCurlyBrace.prototype.cst.SHAPE_CURLY_BRACE, mxShapeMockupCurlyBrace);

//**********************************************************************************************************************************************************
//Line
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupLine(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupLine, mxShape);

mxShapeMockupLine.prototype.cst = {
		SHAPE_LINE : 'mxgraph.mockup.markup.line'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupLine.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupLine.prototype.cst.SHAPE_LINE, mxShapeMockupLine);

//**********************************************************************************************************************************************************
//Scratch Out
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupScratchOut(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupScratchOut, mxShape);

mxShapeMockupScratchOut.prototype.cst = {
		SHAPE_SCRATCH_OUT : 'mxgraph.mockup.markup.scratchOut'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupScratchOut.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.begin();
	c.moveTo(w * 0.038, h * 0.095);
	c.curveTo(w * 0.038, h * 0.095, w * 0.289, h * -0.045, w * 0.186, h * 0.05);
	c.curveTo(w * 0.084, h * 0.145, w * -0.046, h * 0.251, w * 0.072, h * 0.208);
	c.curveTo(w * 0.191, h * 0.164, w * 0.522, h * -0.09, w * 0.366, h * 0.062);
	c.curveTo(w * 0.21, h * 0.215, w * -0.094, h * 0.38, w * 0.108, h * 0.304);
	c.curveTo(w * 0.309, h * 0.228, w * 0.73, h * -0.126, w * 0.544, h * 0.096);
	c.curveTo(w * 0.358, h * 0.319, w * -0.168, h * 0.592, w * 0.108, h * 0.476);
	c.curveTo(w * 0.382, h * 0.36, w * 0.972, h * -0.138, w * 0.779, h * 0.114);
	c.curveTo(w * 0.585, h * 0.365, w * -0.12, h * 0.688, w * 0.071, h * 0.639);
	c.curveTo(w * 0.262, h * 0.59, w * 1.174, h * 0.012, w * 0.936, h * 0.238);
	c.curveTo(w * 0.699, h * 0.462, w * -0.216, h * 0.855, w * 0.085, h * 0.806);
	c.curveTo(w * 0.386, h * 0.758, w * 1.185, h * 0.26, w * 0.935, h * 0.534);
	c.curveTo(w * 0.685, h * 0.808, w * -0.186, h * 0.94, w * 0.236, h * 0.895);
	c.curveTo(w * 0.659, h * 0.85, w * 1.095, h * 0.608, w * 0.905, h * 0.769);
	c.curveTo(w * 0.715, h * 0.93, w * 0.286, h * 0.962, w * 0.661, h * 0.931);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupScratchOut.prototype.cst.SHAPE_SCRATCH_OUT, mxShapeMockupScratchOut);

//**********************************************************************************************************************************************************
//Red X
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupRedX(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupRedX, mxShape);

mxShapeMockupRedX.prototype.cst = {
		SHAPE_RED_X : 'mxgraph.mockup.markup.redX'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupRedX.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.begin();
	c.moveTo(w * 0.1, 0);
	c.lineTo(w * 0.5, h * 0.4);
	c.lineTo(w * 0.9, 0);
	c.lineTo(w, h * 0.1);
	c.lineTo(w * 0.6, h * 0.5);
	c.lineTo(w, h * 0.9);
	c.lineTo(w * 0.9, h);
	c.lineTo(w * 0.5, h * 0.6);
	c.lineTo(w * 0.1, h);
	c.lineTo(0, h * 0.9);
	c.lineTo(w * 0.4, h * 0.5);
	c.lineTo(0, h * 0.1);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupRedX.prototype.cst.SHAPE_RED_X, mxShapeMockupRedX);