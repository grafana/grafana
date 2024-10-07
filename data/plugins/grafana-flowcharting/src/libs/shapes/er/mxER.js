/**
 * $Id: mxER.js,v 1.6 2013/05/17 13:46:41 mate Exp $
 * Copyright (c) 2006-2010, JGraph Ltd
 */

//TODO markers.html probably isn't needed, because it was used for testing during development before the new canvas was introduced

//**********************************************************************************************************************************************************
//Entity
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeEREntity(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeEREntity, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeEREntity.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, 'buttonText', 'Entity');
	var fontColor = mxUtils.getValue(this.style, 'textColor', '#666666');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17');
	c.translate(x, y);
	var rSize = 10;
	w = Math.max(w, 2 * rSize);
	h = Math.max(h, 2 * rSize);
	this.background(c, x, y, w, h, rSize, fontColor);
	c.setShadow(false);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
};

mxShapeEREntity.prototype.background = function(c, x, y, w, h, rSize, fontColor)
{
	var buttonStyle = mxUtils.getValue(this.style, 'buttonStyle', 'round').toString();

	if (buttonStyle === 'round')
	{
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
		c.fillAndStroke();
	}
	else if (buttonStyle === 'rect')
	{
		c.begin();
		c.moveTo(0, 0);
		c.lineTo(w, 0);
		c.lineTo(w, h);
		c.lineTo(0, h);
		c.close();	
		c.fillAndStroke();
	}
	else if (buttonStyle === 'dblFrame')
	{
		var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
		c.setFillColor(fillColor);
		c.begin();
		c.moveTo(0, 0);
		c.lineTo(w, 0);
		c.lineTo(w, h);
		c.lineTo(0, h);
		c.close();	
		c.fillAndStroke();
		rSize = Math.min(w, h);
		c.begin();
		c.moveTo(rSize * 0.1, rSize * 0.1);
		c.lineTo(w - rSize * 0.1, rSize * 0.1);
		c.lineTo(w - rSize * 0.1, h - rSize * 0.1);
		c.lineTo(rSize * 0.1, h - rSize * 0.1);
		c.close();	
		c.stroke();
	}

};

mxShapeEREntity.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5, h * 0.5, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape('mxgraph.er.entity', mxShapeEREntity);

mxShapeEREntity.prototype.constraints = [
                                           new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                           ];

//**********************************************************************************************************************************************************
//Entity Extended
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeEREntityExt(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeEREntityExt, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeEREntityExt.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, 'buttonText', 'Entity');
	var attributes = mxUtils.getValue(this.style, 'subText', '+ attribute 1,+ attribute 2,+ attribute 3').toString().split(',');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#666666');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17');
	var mainColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#008cff');
	var attrColor = mxUtils.getValue(this.style, 'fillColor2', '#ffffff');
	var maxTextWidth = 0;
	c.translate(x, y);
	var rSize = 10;
	var barY = fontSize * 1.25;

	for (var i = 0; i < attributes.length; i++)
	{
		var currWidth = mxUtils.getSizeForString(attributes[i], fontSize, mxConstants.DEFAULT_FONTFAMILY).width;

		if (currWidth > maxTextWidth)
		{
			maxTextWidth = currWidth;
		}
	}

	w = Math.max(w, 2 * rSize, maxTextWidth + rSize);
	h = Math.max(h, 2 * rSize, (attributes.length + 1) * barY);
	this.background(c, x, y, w, h, rSize);
	c.setShadow(false);
	this.shapes(c, x, y, w, h, fontSize, mainColor, attrColor, rSize, barY);
	this.mainText(c, x, y, w, h, mainText, fontSize, attrColor);
	this.attrText(c, x, y, w, h, attributes, fontSize, strokeColor, barY, rSize);
};

mxShapeEREntityExt.prototype.background = function(c, x, y, w, h, rSize)
{
	var buttonStyle = mxUtils.getValue(this.style, 'buttonStyle', 'round').toString();
	c.begin();

	if (buttonStyle === 'round')
	{
		c.moveTo(0, rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
		c.lineTo(w - rSize, 0);
		c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
		c.lineTo(w, h - rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
		c.lineTo(rSize, h);
		c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	}
	else if (buttonStyle === 'rect')
	{
		c.moveTo(0, 0);
		c.lineTo(w, 0);
		c.lineTo(w, h);
		c.lineTo(0, h);
	}

	c.close();	
	c.fillAndStroke();
};

mxShapeEREntityExt.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5, fontSize * 0.5, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxShapeEREntityExt.prototype.shapes = function(c, x, y, w, h, fontSize, mainColor, attrColor, rSize, barY)
{
	var buttonStyle = mxUtils.getValue(this.style, 'buttonStyle', 'round').toString();

	if (buttonStyle === 'round')
	{
		c.begin();
		c.moveTo(0, rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
		c.lineTo(w - rSize, 0);
		c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
		c.lineTo(w, barY);
		c.lineTo(0, barY);
		c.close();
		c.fill();

		c.setFillColor(attrColor);
		c.begin();
		c.moveTo(w, barY);
		c.lineTo(w, h - rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
		c.lineTo(rSize, h);
		c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
		c.lineTo(0, barY);
		c.close();
		c.fill();
	}
	else if (buttonStyle === 'rect')
	{
		c.begin();
		c.moveTo(0, 0);
		c.lineTo(w, 0);
		c.lineTo(w, barY);
		c.lineTo(0, barY);
		c.close();
		c.fill();

		c.setFillColor(attrColor);
		c.begin();
		c.moveTo(0, barY);
		c.lineTo(w, barY);
		c.lineTo(w, h);
		c.lineTo(0, h);
		c.close();
		c.fill();
	}

	c.begin();

	if (buttonStyle === 'round')
	{
		c.moveTo(0, rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
		c.lineTo(w - rSize, 0);
		c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
		c.lineTo(w, h - rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
		c.lineTo(rSize, h);
		c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	}
	else if (buttonStyle === 'rect')
	{
		c.moveTo(0, 0);
		c.lineTo(w, 0);
		c.lineTo(w, h);
		c.lineTo(0, h);
	}

	c.close();	
	c.stroke();
};

mxShapeEREntityExt.prototype.attrText = function(c, x, y, w, h, attributes, fontSize, fontColor, barY, rSize)
{
	for (var i = 0; i < attributes.length; i++)
	{
		c.begin();
		c.setFontSize(fontSize);
		c.setFontColor(fontColor);
		c.text(rSize * 0.5, (i + 1.5) * barY, 0, 0, attributes[i], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
};

mxCellRenderer.registerShape('mxgraph.er.entityExt', mxShapeEREntityExt);

mxShapeEREntityExt.prototype.constraints = [
                                         new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                         new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                         new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                         new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                         new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                         new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                         new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                         new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                         new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                         ];

//**********************************************************************************************************************************************************
//Attribute
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeERAttribute(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeERAttribute, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeERAttribute.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, 'buttonText', 'Entity');
	var fontColor = mxUtils.getValue(this.style, 'textColor', '#666666');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17');
	c.translate(x, y);
	var rSize = 10;
	w = Math.max(w, 2 * rSize);
	h = Math.max(h, 2 * rSize);
	this.background(c, x, y, w, h, rSize, fontColor);
	c.setShadow(false);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
};

mxShapeERAttribute.prototype.background = function(c, x, y, w, h, rSize, fontColor)
{
	var buttonStyle = mxUtils.getValue(this.style, 'buttonStyle', 'simple').toString();

	if (buttonStyle === 'simple')
	{
		c.begin();
		c.ellipse(0, 0, w, h);
		c.fillAndStroke();
	}
	else if (buttonStyle === 'dblFrame')
	{
		var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#666666');
		c.setFillColor(fillColor);
		c.begin();
		c.ellipse(0, 0, w, h);
		c.fillAndStroke();
		rSize = Math.min(w, h);
		c.begin();
		c.ellipse(rSize * 0.1, rSize * 0.1, w - rSize * 0.2, h - rSize * 0.2);
		c.stroke();
	}
};

mxShapeERAttribute.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5, h * 0.5, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape('mxgraph.er.attribute', mxShapeERAttribute);

mxShapeERAttribute.prototype.constraints = [
                                                 new mxConnectionConstraint(new mxPoint(0.144, 0.144), false),
                                                 new mxConnectionConstraint(new mxPoint(0.856, 0.144), false),
                                                 new mxConnectionConstraint(new mxPoint(0.856, 0.856), false),
                                                 new mxConnectionConstraint(new mxPoint(0.144, 0.856), false),
                                                 new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                                 new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                                 new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                                 new mxConnectionConstraint(new mxPoint(0.5, 1), true)
                                                 ];

//**********************************************************************************************************************************************************
//Has
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeERHas(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeERHas, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeERHas.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, 'buttonText', 'Entity');
	var fontColor = mxUtils.getValue(this.style, 'textColor', '#666666');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17');
	c.translate(x, y);
	var rSize = 10;
	w = Math.max(w, 2 * rSize);
	h = Math.max(h, 2 * rSize);
	this.background(c, x, y, w, h, rSize, fontColor);
	c.setShadow(false);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
};

mxShapeERHas.prototype.background = function(c, x, y, w, h, rSize, fontColor)
{
	var buttonStyle = mxUtils.getValue(this.style, 'buttonStyle', 'rhombus').toString();

	if (buttonStyle === 'rhombus')
	{
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w * 0.5, 0);
		c.lineTo(w, h * 0.5);
		c.lineTo(w * 0.5, h);
		c.close();	
		c.fillAndStroke();
	}
	else if (buttonStyle === 'dblFrame')
	{
		var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#666666');
		c.setFillColor(fillColor);
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w * 0.5, 0);
		c.lineTo(w, h * 0.5);
		c.lineTo(w * 0.5, h);
		c.close();	
		c.fillAndStroke();
		c.begin();
		c.moveTo(w * 0.1, h * 0.5);
		c.lineTo(w * 0.5, h * 0.1);
		c.lineTo(w * 0.9, h * 0.5);
		c.lineTo(w * 0.5, h * 0.9);
		c.close();	
		c.stroke();
	}
};

mxShapeERHas.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5, h * 0.5, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape('mxgraph.er.has', mxShapeERHas);

mxShapeERHas.prototype.constraints = [
                                      new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                      new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                      new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                      new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                      new mxConnectionConstraint(new mxPoint(0.25, 0.25), false),
                                      new mxConnectionConstraint(new mxPoint(0.25, 0.75), false),
                                      new mxConnectionConstraint(new mxPoint(0.75, 0.25), false),
                                      new mxConnectionConstraint(new mxPoint(0.75, 0.75), false)
                                      ];

//**********************************************************************************************************************************************************
//Cloud
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeERCloud(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeERCloud, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeERCloud.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, 'buttonText', 'Entity');
	var fontColor = mxUtils.getValue(this.style, 'textColor', '#666666');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17');
	c.translate(x, y);
	var rSize = 10;
	w = Math.max(w, 2 * rSize);
	h = Math.max(h, 2 * rSize);
	this.background(c, x, y, w, h, rSize, fontColor);
	c.setShadow(false);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
};

mxShapeERCloud.prototype.background = function(c, x, y, w, h, rSize, fontColor)
{
	c.begin();
	c.moveTo(0.25 * w, 0.25 * h);
	c.curveTo(0.05 * w, 0.25 * h, 0, 0.5 * h, 0.16 * w, 0.55 * h);
	c.curveTo(0, 0.66 * h, 0.18 * w, 0.9 * h, 0.31 * w, 0.8 * h);
	c.curveTo(0.4 * w, h, 0.7 * w, h, 0.8 * w, 0.8 * h);
	c.curveTo(w, 0.8 * h, w, 0.6 * h, 0.875 * w, 0.5 * h); 
	c.curveTo(w, 0.3 * h, 0.8 * w, 0.1 * h, 0.625 * w, 0.2 * h);
	c.curveTo(0.5 * w, 0.05 * h, 0.3 * w, 0.05 * h, 0.25 * w, 0.25 * h);
	c.fillAndStroke();
};

mxShapeERCloud.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5, h * 0.5, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape('mxgraph.er.cloud', mxShapeERCloud);

mxShapeERCloud.prototype.constraints = [
                                        new mxConnectionConstraint(new mxPoint(0.08, 0.5), false),
                                        new mxConnectionConstraint(new mxPoint(0.9, 0.5), false),
                                        new mxConnectionConstraint(new mxPoint(0.5, 0.1), false),
                                        new mxConnectionConstraint(new mxPoint(0.5, 0.92), false),
                                        new mxConnectionConstraint(new mxPoint(0.24, 0.24), false),
                                        new mxConnectionConstraint(new mxPoint(0.22, 0.8), false),
                                        new mxConnectionConstraint(new mxPoint(0.81, 0.2), false),
                                        new mxConnectionConstraint(new mxPoint(0.78, 0.78), false)
                                      ];

//**********************************************************************************************************************************************************
//Hierarchy (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeERHierarchy(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeERHierarchy, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeERHierarchy.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, 'buttonText', 'main').toString().split(',');
	var subText = mxUtils.getValue(this.style, 'subText', 'sub').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, 'textColor', '#666666');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17');
	c.translate(x, y);
	var rSize = 10;
	w = Math.max(w, 2 * rSize);
	h = Math.max(h, 2 * rSize);
	this.background(c, x, y, w, h, rSize, fontColor);
	c.setShadow(false);
	this.shapeText(c, x, y, w, h, mainText, subText, fontSize, fontColor);
};

mxShapeERHierarchy.prototype.background = function(c, x, y, w, h, rSize, fontColor)
{
	var buttonStyle = mxUtils.getValue(this.style, 'buttonStyle', 'round').toString();

	if (buttonStyle === 'round')
	{
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
		c.fillAndStroke();
	}
	else if (buttonStyle === 'rect')
	{
		c.begin();
		c.moveTo(0, 0);
		c.lineTo(w, 0);
		c.lineTo(w, h);
		c.lineTo(0, h);
		c.close();	
		c.fillAndStroke();
	}
	else if (buttonStyle === 'dblFrame')
	{
		var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#666666');
		c.setFillColor(fillColor);
		c.begin();
		c.moveTo(0, 0);
		c.lineTo(w, 0);
		c.lineTo(w, h);
		c.lineTo(0, h);
		c.close();	
		c.fillAndStroke();
		rSize = Math.min(w, h);
		c.begin();
		c.moveTo(rSize * 0.1, rSize * 0.1);
		c.lineTo(w - rSize * 0.1, rSize * 0.1);
		c.lineTo(w - rSize * 0.1, h - rSize * 0.1);
		c.lineTo(rSize * 0.1, h - rSize * 0.1);
		c.close();	
		c.stroke();
	}

	var trX = 0;
	var trY = 0;

	if (buttonStyle === 'round')
	{
		trX = w * 0.5;
		trY = rSize;
		c.translate(trX, trY);
		w = w * 0.5 - rSize;
		h = h - 2 * rSize;
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
		c.fillAndStroke();
	}
	else if (buttonStyle === 'rect')
	{
		trX = w * 0.5;
		trY = rSize;
		c.translate(trX, trY);
		w = w * 0.5 - rSize;
		h = h - 2 * rSize;
		c.begin();
		c.moveTo(0, 0);
		c.lineTo(w, 0);
		c.lineTo(w, h);
		c.lineTo(0, h);
		c.close();	
		c.fillAndStroke();
	}
	else if (buttonStyle === 'dblFrame')
	{
		trX = w * 0.5;
		trY = rSize * 0.15;
		c.translate(trX, trY);
		w = w * 0.5 - rSize * 0.15;
		h = h - rSize * 0.3;
		var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#666666');
		c.setFillColor(fillColor);
		c.begin();
		c.moveTo(0, 0);
		c.lineTo(w, 0);
		c.lineTo(w, h);
		c.lineTo(0, h);
		c.close();	
		c.fillAndStroke();
		rSize = Math.min(w, h);
		c.begin();
		c.moveTo(rSize * 0.1, rSize * 0.1);
		c.lineTo(w - rSize * 0.1, rSize * 0.1);
		c.lineTo(w - rSize * 0.1, h - rSize * 0.1);
		c.lineTo(rSize * 0.1, h - rSize * 0.1);
		c.close();	
		c.stroke();
	}

	c.translate(- trX, - trY);

};

mxShapeERHierarchy.prototype.shapeText = function(c, x, y, w, h, text, subText, fontSize, fontColor, rSize)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.25, (h - fontSize) * 0.5, 0, 0, text[0], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.25, (h + fontSize) * 0.5, 0, 0, text[1], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.7, (h - fontSize) * 0.5, 0, 0, subText[0], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.7, (h + fontSize) * 0.5, 0, 0, subText[1], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape('mxgraph.er.hierarchy', mxShapeERHierarchy);

mxShapeERHierarchy.prototype.constraints = [
                                         new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                         new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                         new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                         new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                         new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                         new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                         new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                         new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                         new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                         ];

//**********************************************************************************************************************************************************
//Note
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeERNote(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeERNote, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeERNote.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, 'buttonText', 'Entity');
	var fontColor = mxUtils.getValue(this.style, 'textColor', '#666666');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17');
	var backColor = mxUtils.getValue(this.style, 'fillColor2', '#ffffff');
	c.translate(x, y);
	var flipSize = 20;
	w = Math.max(w, flipSize * 2);
	h = Math.max(h, flipSize * 2);
	this.background(c, x, y, w, h, flipSize);
	c.setShadow(false);
	this.flipShape(c, x, y, w, h, flipSize, backColor);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
};

mxShapeERNote.prototype.background = function(c, x, y, w, h, flipSize)
{
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w - flipSize, 0);
	c.lineTo(w, flipSize);
	c.lineTo(w, h);
	c.lineTo(0, h);
	c.close();	
	c.fillAndStroke();
};

mxShapeERNote.prototype.flipShape = function(c, x, y, w, h, flipSize, backColor)
{
	c.setLineJoin('round');
	c.setFillColor(backColor);
	c.begin();
	c.moveTo(w - flipSize, 0);
	c.lineTo(w, flipSize);
	c.lineTo(w - flipSize, flipSize);
	c.close();	
	c.fillAndStroke();
};

mxShapeERNote.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5, h * 0.5, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape('mxgraph.er.note', mxShapeERNote);

mxShapeERNote.prototype.constraints = [
                                           new mxConnectionConstraint(new mxPoint(0, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 1), true),
                                           new mxConnectionConstraint(new mxPoint(1, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                           ];

//**********************************************************************************************************************************************************
//Chen's Notation Legend (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeERChen(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeERChen, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeERChen.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var fontColor = mxUtils.getValue(this.style, 'textColor', '#666666');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17');
	c.translate(x, y);
	var flipSize = 20;
	w = Math.max(w, flipSize * 2);
	h = Math.max(h, flipSize * 2);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, fontSize, fontColor);
};

mxShapeERChen.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h);
	c.lineTo(0, h);
	c.close();	
	c.fillAndStroke();
};

mxShapeERChen.prototype.foreground = function(c, x, y, w, h, fontSize, fontColor)
{
	c.begin();
	c.moveTo(0, h * 0.25);
	c.lineTo(w, h * 0.25);
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.moveTo(0, h * 0.75);
	c.lineTo(w, h * 0.75);

	c.moveTo(w * 0.25, h * 0.5);
	c.lineTo(w * 0.25, h);

	c.moveTo(w * 0.5, h * 0.25);
	c.lineTo(w * 0.5, h);

	c.moveTo(w * 0.75, h * 0.5);
	c.lineTo(w * 0.75, h);
	c.stroke();

	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5, h * 0.125, 0, 0, 'ERD Peter Chen\'s Notation', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFontSize(fontSize * 0.85);
	c.text(w * 0.25, h * 0.375, 0, 0, 'Cardinality', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.75, h * 0.375, 0, 0, 'Optionality', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFontSize(fontSize * 0.7);
	c.text(w * 0.125, h * 0.625, 0, 0, '1', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.375, h * 0.625, 0, 0, 'One', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.625, h * 0.625, 0, 0, '0', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.875, h * 0.625, 0, 0, 'Optional', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.text(w * 0.125, h * 0.875, 0, 0, 'N', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.375, h * 0.875, 0, 0, 'Many', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.625, h * 0.875, 0, 0, '1', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.875, h * 0.875, 0, 0, 'Mandatory', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape('mxgraph.er.chens', mxShapeERChen);

mxShapeERChen.prototype.constraints = [
                                       new mxConnectionConstraint(new mxPoint(0, 0), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0, 1), true),
                                       new mxConnectionConstraint(new mxPoint(1, 1), true),
                                       new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                       new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                       new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                       new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                       new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                       new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                       ];

//**********************************************************************************************************************************************************
//Bachman's Notation Legend (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeERBachman(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeERBachman, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeERBachman.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var fontColor = mxUtils.getValue(this.style, 'textColor', '#666666');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17');
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, fontSize, fontColor);
};

mxShapeERBachman.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h);
	c.lineTo(0, h);
	c.close();	
	c.fillAndStroke();
};

mxShapeERBachman.prototype.foreground = function(c, x, y, w, h, fontSize, fontColor)
{
	c.begin();
	c.moveTo(0, h * 0.125);
	c.lineTo(w, h * 0.125);
	c.moveTo(0, h * 0.25);
	c.lineTo(w, h * 0.25);
	c.moveTo(0, h * 0.375);
	c.lineTo(w, h * 0.375);
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.moveTo(0, h * 0.625);
	c.lineTo(w, h * 0.625);
	c.moveTo(0, h * 0.75);
	c.lineTo(w, h * 0.75);
	c.moveTo(0, h * 0.875);
	c.lineTo(w, h * 0.875);

	c.moveTo(w * 0.5, h * 0.125);
	c.lineTo(w * 0.5, h);
	c.stroke();

	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5, h * 0.0625, 0, 0, 'ERD Bachman\'s Notation', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFontSize(fontSize * 0.85);
	c.text(w * 0.52, h * 0.1875, 0, 0, 'Relationship', mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.52, h * 0.3125, 0, 0, 'Cardinality (One)', mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.52, h * 0.4375, 0, 0, 'Cardinality (Many)', mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.52, h * 0.5625, 0, 0, 'Mandatory, One', mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.52, h * 0.6875, 0, 0, 'Mandatory, Many', mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.52, h * 0.8125, 0, 0, 'Optional, One', mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.52, h * 0.9375, 0, 0, 'Optional, Many', mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	var textWidth = mxUtils.getSizeForString('has/forms', fontSize, mxConstants.DEFAULT_FONTFAMILY).width;
	c.begin();
	c.moveTo(w * 0.04, h * 0.1875);
	c.lineTo(w * 0.25  - textWidth * 0.5, h * 0.1875);
	c.moveTo(w * 0.25  + textWidth * 0.5, h * 0.1875);
	c.lineTo(w * 0.46, h * 0.1875);

	c.text(w * 0.25, h * 0.1875, 0, 0, 'has/forms', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, true, 0, 0);

	c.moveTo(w * 0.04, h * 0.3125);
	c.lineTo(w * 0.46, h * 0.3125);

	c.moveTo(w * 0.04, h * 0.4375);
	c.lineTo(w * 0.46, h * 0.4375);
	c.moveTo(w * 0.46, h * 0.4050);
	c.lineTo(w * 0.4, h * 0.4375);
	c.lineTo(w * 0.46, h * 0.47);

	c.moveTo(w * 0.04, h * 0.5625);
	c.lineTo(w * 0.46, h * 0.5625);
	c.moveTo(w * 0.38, h * 0.53);
	c.lineTo(w * 0.38, h * 0.595);

	c.moveTo(w * 0.04, h * 0.6875);
	c.lineTo(w * 0.46, h * 0.6875);
	c.moveTo(w * 0.46, h * 0.655);
	c.lineTo(w * 0.4, h * 0.6875);
	c.lineTo(w * 0.46, h * 0.72);
	c.moveTo(w * 0.38, h * 0.655);
	c.lineTo(w * 0.38, h * 0.72);

	c.moveTo(w * 0.04, h * 0.8125);
	c.lineTo(w * 0.46, h * 0.8125);

	c.moveTo(w * 0.04, h * 0.9375);
	c.lineTo(w * 0.46, h * 0.9375);
	c.moveTo(w * 0.46, h * 0.9050);
	c.lineTo(w * 0.4, h * 0.9375);
	c.lineTo(w * 0.46, h * 0.97);

	c.stroke();

	var ellSize = h / 15;
	c.begin();
	c.ellipse(w * 0.46 - ellSize, h * 0.8125 - ellSize * 0.5, ellSize, ellSize);
	c.fillAndStroke();

	c.begin();
	c.ellipse(w * 0.4 - ellSize, h * 0.9375 - ellSize * 0.5, ellSize, ellSize);
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.er.bachmans', mxShapeERBachman);

mxShapeERBachman.prototype.constraints = [
                                       new mxConnectionConstraint(new mxPoint(0, 0), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0, 1), true),
                                       new mxConnectionConstraint(new mxPoint(1, 1), true),
                                       new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                       new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                       new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                       new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                       new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                       new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                       ];

//**********************************************************************************************************************************************************
//Information Engineering Notation Legend (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeERInfEng(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeERInfEng, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeERInfEng.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var fontColor = mxUtils.getValue(this.style, 'textColor', '#666666');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17');
	c.translate(x, y);
	w = Math.max(w, h / 1.5);
	h = Math.max(h, fontSize * 5);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, fontSize, fontColor);
};

mxShapeERInfEng.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h);
	c.lineTo(0, h);
	c.close();	
	c.fillAndStroke();
};

mxShapeERInfEng.prototype.foreground = function(c, x, y, w, h, fontSize, fontColor)
{
	c.begin();
	c.moveTo(0, h * 0.2);
	c.lineTo(w, h * 0.2);
	c.moveTo(0, h * 0.4);
	c.lineTo(w, h * 0.4);
	c.moveTo(0, h * 0.6);
	c.lineTo(w, h * 0.6);
	c.moveTo(0, h * 0.8);
	c.lineTo(w, h * 0.8);

	c.moveTo(w * 0.5, h * 0.2);
	c.lineTo(w * 0.5, h);
	c.stroke();

	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5, h * 0.1, 0, 0, 'ERD Information Engineering Notation', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFontSize(fontSize * 0.85);
	c.text(w * 0.52, h * 0.3, 0, 0, 'Zero or one', mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.52, h * 0.5, 0, 0, 'One only', mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.52, h * 0.7, 0, 0, 'Zero or more', mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.52, h * 0.9, 0, 0, 'One or more', mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	var ellSize = h / 12;

	c.begin();
	c.moveTo(w * 0.04, h * 0.3);
	c.lineTo(w * 0.46, h * 0.3);
	c.moveTo(w * 0.46 - ellSize, h * 0.25);
	c.lineTo(w * 0.46 - ellSize, h * 0.35);

	c.moveTo(w * 0.04, h * 0.5);
	c.lineTo(w * 0.46, h * 0.5);
	c.moveTo(w * 0.46 - ellSize * 2, h * 0.45);
	c.lineTo(w * 0.46 - ellSize * 2, h * 0.55);
	c.moveTo(w * 0.46 - ellSize * 2.5, h * 0.45);
	c.lineTo(w * 0.46 - ellSize * 2.5, h * 0.55);

	c.moveTo(w * 0.04, h * 0.7);
	c.lineTo(w * 0.46, h * 0.7);
	c.moveTo(w * 0.46, h * 0.65);
	c.lineTo(w * 0.46 - ellSize * 2, h * 0.7);
	c.lineTo(w * 0.46, h * 0.75);
	c.stroke();

	c.moveTo(w * 0.04, h * 0.9);
	c.lineTo(w * 0.46, h * 0.9);
	c.moveTo(w * 0.46, h * 0.85);
	c.lineTo(w * 0.46 - ellSize * 2, h * 0.9);
	c.lineTo(w * 0.46, h * 0.95);
	c.moveTo(w * 0.46 - ellSize * 2.5, h * 0.85);
	c.lineTo(w * 0.46 - ellSize * 2.5, h * 0.95);
	c.stroke();

	c.begin();
	c.ellipse(w * 0.46 - ellSize * 3, h * 0.3 - ellSize * 0.5, ellSize, ellSize);
	c.fillAndStroke();

	c.begin();
	c.ellipse(w * 0.46 - ellSize * 3, h * 0.7 - ellSize * 0.5, ellSize, ellSize);
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.er.ie', mxShapeERInfEng);

mxShapeERInfEng.prototype.constraints = [
                                          new mxConnectionConstraint(new mxPoint(0, 0), true),
                                          new mxConnectionConstraint(new mxPoint(1, 0), true),
                                          new mxConnectionConstraint(new mxPoint(0, 1), true),
                                          new mxConnectionConstraint(new mxPoint(1, 1), true),
                                          new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                          new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                          new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                          new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                          new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                          new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                          new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                          new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                          new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                          new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                          new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                          new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                          ];

// ER markers
mxMarker.addMarker('ERone', function(c, shape, type, pe, unitX, unitY, size, source, sw, filled)
{
	var nx = unitX * (size + sw + 1);
	var ny = unitY * (size + sw + 1);

	return function()
	{
		c.begin();
		c.moveTo(pe.x - nx / 2 - ny / 2, pe.y - ny / 2 + nx / 2);
		c.lineTo(pe.x - nx / 2 + ny / 2, pe.y - ny / 2 - nx / 2);
		c.stroke();
	};
});

mxMarker.addMarker('ERmandOne', function(c, shape, type, pe, unitX, unitY, size, source, sw, filled)
{
	var nx = unitX * (size + sw + 1);
	var ny = unitY * (size + sw + 1);

	return function()
	{
		c.begin();
		c.moveTo(pe.x - nx / 2 - ny / 2, pe.y - ny / 2 + nx / 2);
		c.lineTo(pe.x - nx / 2 + ny / 2, pe.y - ny / 2 - nx / 2);
		c.moveTo(pe.x - nx - ny / 2, pe.y - ny + nx / 2);
		c.lineTo(pe.x - nx + ny / 2, pe.y - ny - nx / 2);
		c.stroke();
	};
});

mxMarker.addMarker('ERmany', function(c, shape, type, pe, unitX, unitY, size, source, sw, filled)
{
	var nx = unitX * (size + sw + 1);
	var ny = unitY * (size + sw + 1);

	return function()
	{
		c.begin();
		c.moveTo(pe.x + ny / 2, pe.y - nx / 2);
		c.lineTo(pe.x - nx, pe.y - ny);
		c.lineTo(pe.x - ny / 2, pe.y + nx / 2);
		c.stroke();
	};
});

mxMarker.addMarker('ERoneToMany', function(c, shape, type, pe, unitX, unitY, size, source, sw, filled)
{
	var nx = unitX * (size + sw + 1);
	var ny = unitY * (size + sw + 1);

	return function()
	{
		c.begin();
		c.moveTo(pe.x - nx - ny / 2, pe.y - ny + nx / 2);
		c.lineTo(pe.x - nx + ny / 2, pe.y - ny - nx / 2);
		c.moveTo(pe.x + ny / 2, pe.y - nx / 2);
		c.lineTo(pe.x - nx, pe.y - ny);
		c.lineTo(pe.x - ny / 2, pe.y + nx / 2);
		c.stroke();
	};
});

mxMarker.addMarker('ERzeroToMany', function(c, shape, type, pe, unitX, unitY, size, source, sw, filled)
{
	var nx = unitX * (size + sw + 1);
	var ny = unitY * (size + sw + 1);
	var a = size / 2;

	return function()
	{
		c.begin();
		c.ellipse(pe.x - 1.5 * nx - a, pe.y - 1.5 * ny - a, 2 * a, 2 * a);

		if (filled)
		{
			// TODO not sure if this is ok, because by default, markers use strokeColor for filling 
			var oldColor = mxUtils.getValue(shape.style, mxConstants.STYLE_STROKECOLOR, '#666666');
			
			c.setFillColor('#ffffff');
			c.fillAndStroke();
			c.setFillColor(oldColor);
		}
		else
		{
			c.stroke();
		}

		c.begin();
		c.moveTo(pe.x + ny / 2, pe.y - nx / 2);
		c.lineTo(pe.x - nx, pe.y - ny);
		c.lineTo(pe.x - ny / 2, pe.y + nx / 2);
		c.stroke();
	};
});

mxMarker.addMarker('ERzeroToOne', function(c, shape, type, pe, unitX, unitY, size, source, sw, filled)
{
	var nx = unitX * (size + sw + 1);
	var ny = unitY * (size + sw + 1);
	var a = size / 2;

	return function()
	{
		c.begin();
		c.ellipse(pe.x - 1.5 * nx - a, pe.y - 1.5 * ny - a, 2 * a, 2 * a);

		if (filled)
		{
			// TODO not sure if this is ok, because by default, markers use strokeColor for filling 
			var oldColor = mxUtils.getValue(shape.style, mxConstants.STYLE_STROKECOLOR, '#666666');
			
			c.setFillColor('#ffffff');
			c.fillAndStroke();
			c.setFillColor(oldColor);
		}
		else
		{
			c.stroke();
		}

		c.begin();
		c.moveTo(pe.x - nx / 2 - ny / 2, pe.y - ny / 2 + nx / 2);
		c.lineTo(pe.x - nx / 2 + ny / 2, pe.y - ny / 2 - nx / 2);
		c.stroke();
	};
});

//**********************************************************************************************************************************************************
//Rounded rectangle (adjustable rounding)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeERRRect(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeERRRect, mxShape);

mxShapeERRRect.prototype.cst = {
		RRECT : 'mxgraph.er.rrect',
		R_SIZE : 'rSize'
};

mxShapeERRRect.prototype.customProperties = [
	{name: 'rSize', dispName: 'Rounding Size', type: 'float'},
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeERRRect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeERRRect.prototype.cst.R_SIZE, '10'));
	c.roundrect(0, 0, w, h, rSize);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeERRRect.prototype.cst.RRECT, mxShapeERRRect);

mxShapeERRRect.prototype.constraints = [
                                            new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                            new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                            new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                            new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                            new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                            new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                            new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                            new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                            new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                            new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                            new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                            new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                            ];

//**********************************************************************************************************************************************************
//Anchor (a dummy shape without visuals used for anchoring)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeERAnchor(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeERAnchor, mxShape);

mxShapeERAnchor.prototype.cst = {
		ANCHOR : 'mxgraph.er.anchor'
};



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeERAnchor.prototype.paintVertexShape = function(c, x, y, w, h)
{
};

mxCellRenderer.registerShape(mxShapeERAnchor.prototype.cst.ANCHOR, mxShapeERAnchor);

