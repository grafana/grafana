/**
 * $Id: mxBootstrap.js,v 1.0 2014/09/10 07:05:39 mate Exp $
 * Copyright (c) 2006-2014, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Rounded rectangle (adjustable rounding)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapRRect(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapRRect, mxShape);

mxShapeBootstrapRRect.prototype.cst = {
		PACKAGE : 'mxgraph.bootstrap.rrect',
		R_SIZE : 'rSize'
};

mxShapeBootstrapRRect.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapRRect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeBootstrapRRect.prototype.cst.R_SIZE, '10'));
	c.roundrect(0, 0, w, h, rSize);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeBootstrapRRect.prototype.cst.PACKAGE, mxShapeBootstrapRRect);

//**********************************************************************************************************************************************************
//Top Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapTopButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapTopButton, mxShape);

mxShapeBootstrapTopButton.prototype.cst = {
		TOP_BUTTON : 'mxgraph.bootstrap.topButton',
		R_SIZE : 'rSize'
};

mxShapeBootstrapTopButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapTopButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeBootstrapTopButton.prototype.cst.R_SIZE, '10'));

	c.begin();
	c.moveTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h);
	c.lineTo(0, h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeBootstrapTopButton.prototype.cst.TOP_BUTTON, mxShapeBootstrapTopButton);

//**********************************************************************************************************************************************************
//Bottom Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapBottomButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapBottomButton, mxShape);

mxShapeBootstrapBottomButton.prototype.cst = {
		BOTTOM_BUTTON : 'mxgraph.bootstrap.bottomButton',
		R_SIZE : 'rSize'
};

mxShapeBootstrapBottomButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapBottomButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeBootstrapBottomButton.prototype.cst.R_SIZE, '10'));

	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h - rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
	c.lineTo(rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeBootstrapBottomButton.prototype.cst.BOTTOM_BUTTON, mxShapeBootstrapBottomButton);

//**********************************************************************************************************************************************************
//Right Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapRightButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapRightButton, mxShape);

mxShapeBootstrapRightButton.prototype.cst = {
		RIGHT_BUTTON : 'mxgraph.bootstrap.rightButton',
		R_SIZE : 'rSize'
};

mxShapeBootstrapRightButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapRightButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeBootstrapRightButton.prototype.cst.R_SIZE, '10'));

	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h - rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
	c.lineTo(0, h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeBootstrapRightButton.prototype.cst.RIGHT_BUTTON, mxShapeBootstrapRightButton);

//**********************************************************************************************************************************************************
//Left Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapLeftButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapLeftButton, mxShape);

mxShapeBootstrapLeftButton.prototype.cst = {
		LEFT_BUTTON : 'mxgraph.bootstrap.leftButton',
		R_SIZE : 'rSize'
};

mxShapeBootstrapLeftButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapLeftButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeBootstrapLeftButton.prototype.cst.R_SIZE, '10'));

	c.begin();
	c.moveTo(w, 0);
	c.lineTo(w, h);
	c.lineTo(rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	c.lineTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeBootstrapLeftButton.prototype.cst.LEFT_BUTTON, mxShapeBootstrapLeftButton);

//**********************************************************************************************************************************************************
//Left Button (Striped)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapLeftButtonStriped(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapLeftButtonStriped, mxShape);

mxShapeBootstrapLeftButtonStriped.prototype.cst = {
		LEFT_BUTTON_STRIPED : 'mxgraph.bootstrap.leftButtonStriped'
};



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapLeftButtonStriped.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	rSize = 5;
	c.begin();
	c.moveTo(w, 0);
	c.lineTo(w, h);
	c.lineTo(rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	c.lineTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.close();
	c.fill();

	
	var fillColor = '#ffffff';
	c.setAlpha('0.2');
	var stripeW = h * 0.5;

	c.setFillColor(fillColor);
	c.begin();
	c.moveTo(0, h * 0.75);
	c.lineTo(0, h * 0.25);
	c.lineTo(h * 0.75, h);
	c.lineTo(h * 0.25, h);
	c.close();
	c.fill();
	
	var end = false;
	var startX = stripeW * 0.5;
	
	while (!end)
	{
		c.begin();
		c.moveTo(startX, 0);
		
		if (startX + stripeW >= w)
		{
			c.lineTo(w, 0);
			c.lineTo(w, w - startX);
		}
		else
		{
			c.lineTo(startX + stripeW, 0);
			
			if (startX + stripeW + h > w)
			{
				c.lineTo(w, w - startX - stripeW);
				
				if (w - startX > h)
				{
					c.lineTo(w, h);
					c.lineTo(startX + h, h);
				}
				else
				{
					c.lineTo(w, w - startX);
				}
			}
			else
			{
				c.lineTo(startX + stripeW + h, h);
				c.lineTo(startX + h, h);
			}
		}

		c.close();
		c.fill();
		
		startX = startX + 2 * stripeW;
		
		if (startX > w)
		{
			end = true;
		}
	}
};

mxCellRenderer.registerShape(mxShapeBootstrapLeftButtonStriped.prototype.cst.LEFT_BUTTON_STRIPED, mxShapeBootstrapLeftButtonStriped);

//**********************************************************************************************************************************************************
//Rounded Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapRoundedButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapRoundedButton, mxShape);

mxShapeBootstrapRoundedButton.prototype.cst = {
		ROUNDED_BUTTON : 'mxgraph.bootstrap.roundedButton'
};



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapRoundedButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	if (w > h)
	{
		var r = h * 0.5;
	
		c.begin();
		c.moveTo(w - r, 0);
		c.arcTo(r, r, 0, 0, 1, w - r, h);
		c.lineTo(r, h);
		c.arcTo(r, r, 0, 0, 1, r, 0);
		c.close();
		c.fillAndStroke();
	}
	else
	{
		var r = w * 0.5;
		
		c.begin();
		c.moveTo(0, h - r);
		c.arcTo(r, r, 0, 0, 0, w, h - r);
		c.lineTo(w, r);
		c.arcTo(r, r, 0, 0, 0, 0, r);
		c.close();
		c.fillAndStroke();
	}
};

mxCellRenderer.registerShape(mxShapeBootstrapRoundedButton.prototype.cst.ROUNDED_BUTTON, mxShapeBootstrapRoundedButton);

//**********************************************************************************************************************************************************
//Arrow
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapArrow(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapArrow, mxShape);

mxShapeBootstrapArrow.prototype.cst = {
		ARROW : 'mxgraph.bootstrap.arrow'
};



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapArrow.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.moveTo(w * 0.9, 0);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.9, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeBootstrapArrow.prototype.cst.ARROW, mxShapeBootstrapArrow);

//**********************************************************************************************************************************************************
//Tab Top
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapTabTop(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapTabTop, mxShape);

mxShapeBootstrapTabTop.prototype.cst = {
		TAB_TOP : 'mxgraph.bootstrap.tabTop',
		R_SIZE  : 'rSize'
};

mxShapeBootstrapTabTop.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:5}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapTabTop.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeBootstrapTopButton.prototype.cst.R_SIZE, '10'));
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');

	c.setStrokeColor(fillColor);
	c.begin();
	c.moveTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h);
	c.lineTo(0, h);
	c.close();
	c.fillAndStroke();

	c.setStrokeColor(strokeColor);
	c.begin();
	c.moveTo(0, h);
	c.lineTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeBootstrapTabTop.prototype.cst.TAB_TOP, mxShapeBootstrapTabTop);

//**********************************************************************************************************************************************************
//Image
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapImage(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapImage, mxShape);

mxShapeBootstrapImage.prototype.cst = {
		IMAGE : 'mxgraph.bootstrap.image',
		R_SIZE  : 'rSize'
};

mxShapeBootstrapImage.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:5}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapImage.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var rSize = Math.max(0, parseInt(mxUtils.getValue(this.style, mxShapeBootstrapTopButton.prototype.cst.R_SIZE, '10')));
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');

	c.begin();
	c.moveTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h - rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
	c.lineTo(rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	c.close();
	c.stroke();

	var rsHalf = rSize * 0.5;
	c.translate(rsHalf, rsHalf);
	w = Math.max(0, w - rSize);
	h = Math.max(0, h - rSize);
	
	c.begin();
	c.moveTo(0, rsHalf);
	c.arcTo(rsHalf, rsHalf, 0, 0, 1, rsHalf, 0);
	c.lineTo(w - rsHalf, 0);
	c.arcTo(rsHalf, rsHalf, 0, 0, 1, w, rsHalf);
	c.lineTo(w, h - rsHalf);
	c.arcTo(rsHalf, rsHalf, 0, 0, 1, w - rsHalf, h);
	c.lineTo(rsHalf, h);
	c.arcTo(rsHalf, rsHalf, 0, 0, 1, 0, h - rsHalf);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxShapeBootstrapImage.prototype.cst.IMAGE, mxShapeBootstrapImage);

//**********************************************************************************************************************************************************
//Checkbox
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapCheckbox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapCheckbox, mxShape);

mxShapeBootstrapCheckbox.prototype.cst = {
		CHECKBOX : 'mxgraph.bootstrap.checkbox'
};



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapCheckbox.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var rSize = 3;
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.fillAndStroke();
	
	c.setStrokeWidth('3');
	c.begin();
	c.moveTo(w * 0.8, h * 0.2);
	c.lineTo(w * 0.4, h * 0.8);
	c.lineTo(w * 0.25, h * 0.6);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeBootstrapCheckbox.prototype.cst.CHECKBOX, mxShapeBootstrapCheckbox);

//**********************************************************************************************************************************************************
//Radio Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapRadioButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapRadioButton, mxShape);

mxShapeBootstrapRadioButton.prototype.cst = {
		RADIO_BUTTON : 'mxgraph.bootstrap.radioButton'
};



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapRadioButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
	
	c.setFillColor(strokeColor);
	c.ellipse(w * 0.25, h * 0.25, w * 0.5, h * 0.5);
	c.fill();
};

mxCellRenderer.registerShape(mxShapeBootstrapRadioButton.prototype.cst.RADIO_BUTTON, mxShapeBootstrapRadioButton);

//**********************************************************************************************************************************************************
//Horizontal Lines
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapHorLines(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapHorLines, mxShape);

mxShapeBootstrapHorLines.prototype.cst = {
		HOR_LINES : 'mxgraph.bootstrap.horLines'
};



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapHorLines.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.rect(0, 0, w, h);
	c.fill();
	
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.moveTo(0, h);
	c.lineTo(w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeBootstrapHorLines.prototype.cst.HOR_LINES, mxShapeBootstrapHorLines);

//**********************************************************************************************************************************************************
//User 2
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapUserTwo(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapUserTwo, mxShape);

mxShapeBootstrapUserTwo.prototype.cst = {
		USER2 : 'mxgraph.bootstrap.user2'
};



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapUserTwo.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(0, h * 0.95);
	c.arcTo(w * 0.3, h * 0.3, 0, 0, 1, w * 0.02, h * 0.87);
	c.arcTo(w * 0.1, h * 0.1, 0, 0, 1, w * 0.08, h * 0.812);
	c.arcTo(w * 3, h * 3, 0, 0, 1, w * 0.29, h * 0.732);
	c.arcTo(w * 0.15, h * 0.15, 0, 0, 0, w * 0.385, h * 0.607);
	c.arcTo(w * 0.11, h * 0.11, 0, 0, 0, w * 0.355, h * 0.53);
	c.arcTo(w * 0.3, h * 0.3, 0, 0, 1, w * 0.305, h * 0.44);
	c.arcTo(w * 0.33, h * 0.38, 0, 0, 1, w * 0.312, h * 0.15);
	c.arcTo(w * 0.218, h * 0.218 , 0, 0, 1, w * 0.688, h * 0.15);
	c.arcTo(w * 0.33, h * 0.38, 0, 0, 1, w * 0.693, h * 0.44);
	c.arcTo(w * 0.25, h * 0.25, 0, 0, 1, w * 0.645, h * 0.53);
	c.arcTo(w * 0.1, h * 0.1, 0, 0, 0, w * 0.612, h * 0.6);
	c.arcTo(w * 0.15, h * 0.15, 0, 0, 0, w * 0.7, h * 0.726);
	c.arcTo(w * 3, h * 3, 0, 0, 1, w * 0.92, h * 0.812);
	c.arcTo(w * 0.1, h * 0.1, 0, 0, 1, w * 0.97, h * 0.865);
	c.arcTo(w * 0.2, h * 0.2, 0, 0, 1, w * 0.995, h * 0.952);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxShapeBootstrapUserTwo.prototype.cst.USER2, mxShapeBootstrapUserTwo);

//**********************************************************************************************************************************************************
//Rating
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBootstrapRating(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeBootstrapRating, mxShape);

mxShapeBootstrapRating.prototype.cst = {
		RATING : 'mxgraph.bootstrap.rating',
		RATING_STYLE : 'ratingStyle',
		RATING_SCALE : 'ratingScale',
		RATING_HEART : 'heart',
		RATING_STAR : 'star',
		EMPTY_FILL_COLOR : 'emptyFillColor',
		GRADE : 'grade'
};

mxShapeBootstrapRating.prototype.customProperties = [
	{name: 'ratingStyle', dispName: 'Rating Style', type: 'enum', 
		enumList: [{val: 'heart', dispName: 'Heart'}, 
		   {val: 'star', dispName: 'Star'}]
	},
	{name: 'ratingScale', dispName: 'Rating Scale', type: 'int', min:1, defVal:5}, 
	{name: 'emptyFillColor', dispName: 'Inactive Color', type: 'color', defVal:'none'},
	{name: 'grade', dispName: 'Grade', type: 'int', min:1, defVal:3} 
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBootstrapRating.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var ratingStyle = mxUtils.getValue(this.style, mxShapeBootstrapRating.prototype.cst.RATING_STYLE, mxShapeBootstrapRating.prototype.cst.RATING_STAR);
	var grade = mxUtils.getValue(this.style, mxShapeBootstrapRating.prototype.cst.GRADE, '5');
	var ratingScale = mxUtils.getValue(this.style, mxShapeBootstrapRating.prototype.cst.RATING_SCALE, '10');

	c.translate(x, y);

	if (ratingStyle === mxShapeBootstrapRating.prototype.cst.RATING_STAR)
	{
		for (var i = 0; i < grade; i++)
		{
			c.begin();
			c.moveTo(i * h * 1.2, 0.33 * h);
			c.lineTo(i * h * 1.2 + 0.364 * h, 0.33 * h);
			c.lineTo(i * h * 1.2 + 0.475 * h, 0);
			c.lineTo(i * h * 1.2 + 0.586 * h, 0.33 * h);
			c.lineTo(i * h * 1.2 + 0.95 * h, 0.33 * h);
			c.lineTo(i * h * 1.2 + 0.66 * h, 0.551 * h);
			c.lineTo(i * h * 1.2 + 0.775 * h, 0.9 * h);
			c.lineTo(i * h * 1.2 + 0.475 * h, 0.684 * h);
			c.lineTo(i * h * 1.2 + 0.175 * h, 0.9 * h);
			c.lineTo(i * h * 1.2 + 0.29 * h, 0.551 * h);
			c.close();
			c.fillAndStroke();
		}
	}
	else if (ratingStyle === mxShapeBootstrapRating.prototype.cst.RATING_HEART)
	{
		for (var i = 0; i < grade; i++)
		{
			c.begin();
			c.moveTo(i * h * 1.2 + h * 0.519, h * 0.947);
			c.curveTo(i * h * 1.2 + h * 0.558, h * 0.908, 
					  i * h * 1.2 + h * 0.778, h * 0.682, 
					  i * h * 1.2 + h * 0.916, h * 0.54);
			c.curveTo(i * h * 1.2 + h * 1.039, h * 0.414, 
					  i * h * 1.2 + h * 1.036, h * 0.229, 
					  i * h * 1.2 + h * 0.924, h * 0.115);
			c.curveTo(i * h * 1.2 + h * 0.812, 0, 
					  i * h * 1.2 + h * 0.631, 0, 
					  i * h * 1.2 + h * 0.519, h * 0.115);
			c.curveTo(i * h * 1.2 + h * 0.408, 0, 
					  i * h * 1.2 + h * 0.227, 0, 
					  i * h * 1.2 + h * 0.115, h * 0.115);
			c.curveTo(i * h * 1.2 + h * 0.03, h * 0.229, 
					  i * h * 1.2, h * 0.414, 
					  i * h * 1.2 + h * 0.123, h * 0.54);
			c.close();
			c.fillAndStroke();
		}
	}

	var emptyFillColor = mxUtils.getValue(this.style, mxShapeBootstrapRating.prototype.cst.EMPTY_FILL_COLOR, '#ffffff');
	c.setFillColor(emptyFillColor);

	if (ratingStyle === mxShapeBootstrapRating.prototype.cst.RATING_STAR)
	{
		for (var i = grade; i < ratingScale; i++)
		{
			c.begin();
			c.moveTo(i * h * 1.2, 0.33 * h);
			c.lineTo(i * h * 1.2 + 0.364 * h, 0.33 * h);
			c.lineTo(i * h * 1.2 + 0.475 * h, 0);
			c.lineTo(i * h * 1.2 + 0.586 * h, 0.33 * h);
			c.lineTo(i * h * 1.2 + 0.95 * h, 0.33 * h);
			c.lineTo(i * h * 1.2 + 0.66 * h, 0.551 * h);
			c.lineTo(i * h * 1.2 + 0.775 * h, 0.9 * h);
			c.lineTo(i * h * 1.2 + 0.475 * h, 0.684 * h);
			c.lineTo(i * h * 1.2 + 0.175 * h, 0.9 * h);
			c.lineTo(i * h * 1.2 + 0.29 * h, 0.551 * h);
			c.close();
			c.fillAndStroke();
		}
	}
	else if (ratingStyle === mxShapeBootstrapRating.prototype.cst.RATING_HEART)
	{
		for (var i = grade; i < ratingScale; i++)
		{
			c.begin();
			c.moveTo(i * h * 1.2 + h * 0.519, h * 0.947);
			c.curveTo(i * h * 1.2 + h * 0.558, h * 0.908, 
					  i * h * 1.2 + h * 0.778, h * 0.682, 
					  i * h * 1.2 + h * 0.916, h * 0.54);
			c.curveTo(i * h * 1.2 + h * 1.039, h * 0.414, 
					  i * h * 1.2 + h * 1.036, h * 0.229, 
					  i * h * 1.2 + h * 0.924, h * 0.115);
			c.curveTo(i * h * 1.2 + h * 0.812, 0, 
					  i * h * 1.2 + h * 0.631, 0, 
					  i * h * 1.2 + h * 0.519, h * 0.115);
			c.curveTo(i * h * 1.2 + h * 0.408, 0, 
					  i * h * 1.2 + h * 0.227, 0, 
					  i * h * 1.2 + h * 0.115, h * 0.115);
			c.curveTo(i * h * 1.2 + h * 0.03, h * 0.229, 
					  i * h * 1.2, h * 0.414, 
					  i * h * 1.2 + h * 0.123, h * 0.54);
			c.close();
			c.fillAndStroke();
		}
	}
};

mxCellRenderer.registerShape(mxShapeBootstrapRating.prototype.cst.RATING, mxShapeBootstrapRating);

//**********************************************************************************************************************************************************
//Anchor (a dummy shape without visuals used for anchoring)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeBoostrapAnchor(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeBoostrapAnchor, mxShape);

mxShapeBoostrapAnchor.prototype.cst = {
		ANCHOR : 'mxgraph.bootstrap.anchor'
};


/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeBoostrapAnchor.prototype.paintVertexShape = function(c, x, y, w, h)
{
};

mxCellRenderer.registerShape(mxShapeBoostrapAnchor.prototype.cst.ANCHOR, mxShapeBoostrapAnchor);

