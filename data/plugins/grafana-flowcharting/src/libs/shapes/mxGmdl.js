/**
 * $Id: mxGmdl.js,v 1.0 2015/09/09 17:05:39 mate Exp $
 * Copyright (c) 2006-2015, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//player
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGmdlPlayer(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeGmdlPlayer, mxShape);

mxShapeGmdlPlayer.prototype.cst = {
		SHAPE_PLAYER : 'mxgraph.gmdl.player'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGmdlPlayer.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.begin();
	c.rect(0, 0, w, h);
	c.fill();
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeGmdlPlayer.prototype.foreground = function(c, x, y, w, h)
{

	if ( h >= 4)
	{
		c.setFillColor('#FFED00');
		c.begin();
		c.rect(0, 0, w * 0.8, 4);
		c.fill();
	}
	
	if ( h >= 14 && w >= 33)
	{
		c.setFillColor('#717171');
		c.begin();
		c.rect(w - 33, h * 0.5 - 7, 4, 14);
		c.fill();
		c.begin();
		c.rect(w - 25, h * 0.5 - 7, 4, 14);
		c.fill();
	}

};

mxCellRenderer.registerShape(mxShapeGmdlPlayer.prototype.cst.SHAPE_PLAYER, mxShapeGmdlPlayer);

//**********************************************************************************************************************************************************
//switch
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGmdlSwitch(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeGmdlSwitch, mxShape);

mxShapeGmdlSwitch.prototype.cst = {
		SHAPE_SWITCH : 'mxgraph.gmdl.switch',
		STATE : 'switchState',
		STATE_ON : 'on',
		STATE_OFF : 'off'
};

mxShapeGmdlSwitch.prototype.customProperties = [
	{name:'switchState', dispName:'State', type:'enum', defVal:'on',
		enumList:[{val:'on', dispName: 'On'}, {val:'off', dispName: 'Off'}]}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGmdlSwitch.prototype.paintVertexShape = function(c, x, y, w, h)
{
	
	c.translate(x, y);
	var state = mxUtils.getValue(this.style, mxShapeGmdlSwitch.prototype.cst.STATE, mxShapeGmdlSwitch.prototype.cst.STATE_ON);
	this.background(c, x, y, w, h, state);
	c.setShadow(true);
	this.foreground(c, x, y, w, h, state);
};

mxShapeGmdlSwitch.prototype.background = function(c, x, y, w, h, state)
{
	c.begin();

	if (state === mxShapeGmdlSwitch.prototype.cst.STATE_ON)
	{
		c.save();
		c.setAlpha('0.5');
		c.moveTo(w * 0.135, h * 0.8);
		c.arcTo(w * 0.135, h * 0.3, 0, 0, 1, w * 0.135, h * 0.2);
		c.lineTo(w * 0.675, h * 0.2);
		c.arcTo(w * 0.135, h * 0.3, 0, 0, 1, w * 0.675, h * 0.8);
		c.close();
		c.fillAndStroke();
		c.restore();
	}
	else
	{
		c.setFillColor('#BCBBBB');
		c.moveTo(w * 0.225, h * 0.8);
		c.arcTo(w * 0.135, h * 0.3, 0, 0, 1, w * 0.225, h * 0.2);
		c.lineTo(w * 0.865, h * 0.2);
		c.arcTo(w * 0.135, h * 0.3, 0, 0, 1, w * 0.865, h * 0.8);
		c.close();
		c.fillAndStroke();
	}

};

mxShapeGmdlSwitch.prototype.foreground = function(c, x, y, w, h, state)
{
	c.begin();

	if (state === mxShapeGmdlSwitch.prototype.cst.STATE_ON)
	{
		c.ellipse(w * 0.36, 0, w * 0.64, h);
	}
	else
	{
		c.setFillColor('#F1F1F1');
		c.ellipse(0, 0, w * 0.64, h);
	}

	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeGmdlSwitch.prototype.cst.SHAPE_SWITCH, mxShapeGmdlSwitch);

//**********************************************************************************************************************************************************
//rect with margins
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGmdlMarginRect(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeGmdlMarginRect, mxShape);

mxShapeGmdlMarginRect.prototype.cst = {
		SHAPE_MARGIN_RECT : 'mxgraph.gmdl.marginRect',
		MARGIN : 'rectMargin',
		MARGIN_TOP : 'rectMarginTop',
		MARGIN_LEFT : 'rectMarginLeft',
		MARGIN_BOTTOM : 'rectMarginBottom',
		MARGIN_RIGHT : 'rectMarginRight'
};

mxShapeGmdlMarginRect.prototype.customProperties = [
	{name:'rectMargin', dispName:'Margin', type:'float', min:0, defVal:0},
	{name:'rectMarginTop', dispName:'Margin Top', type:'float', defVal:0},
	{name:'rectMarginLeft', dispName:'Margin Left', type:'float', defVal:0},
	{name:'rectMarginBottom', dispName:'Margin Bottom', type:'float', defVal:0},
	{name:'rectMarginRight', dispName:'Margin Right', type:'float', defVal:0}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGmdlMarginRect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxShapeGmdlMarginRect.prototype.background = function(c, x, y, w, h, state)
{
	var margin = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlMarginRect.prototype.cst.MARGIN, '0'));
	var marginTop = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlMarginRect.prototype.cst.MARGIN_TOP, '0'));
	var marginLeft = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlMarginRect.prototype.cst.MARGIN_LEFT, '0'));
	var marginBottom = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlMarginRect.prototype.cst.MARGIN_BOTTOM, '0'));
	var marginRight = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlMarginRect.prototype.cst.MARGIN_RIGHT, '0'));

	var x1 = margin + marginLeft;
	var y1 = margin + marginTop;
	var w1 = w - marginRight - x1 - margin;
	var h1 = h - marginBottom - y1 - margin;

	if (w1 >0 && h1 > 0)
	{
		c.begin();
		c.rect(x1, y1, w1, h1);
		c.fillAndStroke();
	}
};

mxCellRenderer.registerShape(mxShapeGmdlMarginRect.prototype.cst.SHAPE_MARGIN_RECT, mxShapeGmdlMarginRect);

//**********************************************************************************************************************************************************
//slider normal
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGmdlSliderNormal(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeGmdlSliderNormal, mxShape);

mxShapeGmdlSliderNormal.prototype.cst = {
		SHAPE_SLIDER_NORMAL : 'mxgraph.gmdl.sliderNormal',
		HANDLE_SIZE : 'handleSize'
};

mxShapeGmdlSliderNormal.prototype.customProperties = [
	{name:'handleSize', dispName:'Handle Size', type:'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGmdlSliderNormal.prototype.paintVertexShape = function(c, x, y, w, h)
{
	
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(true);
};

mxShapeGmdlSliderNormal.prototype.background = function(c, x, y, w, h)
{
	var hSize = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSliderNormal.prototype.cst.HANDLE_SIZE, '10'));

	c.ellipse(0, h * 0.5 - hSize * 0.5, hSize, hSize);
	c.stroke();
	
	c.begin();
	c.moveTo(hSize, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeGmdlSliderNormal.prototype.cst.SHAPE_SLIDER_NORMAL, mxShapeGmdlSliderNormal);

//**********************************************************************************************************************************************************
//slider normal v2
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGmdlSlider2(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeGmdlSlider2, mxShape);

mxShapeGmdlSlider2.prototype.cst = {
		SHAPE_SLIDER : 'mxgraph.gmdl.slider2',
		BAR_POS : 'barPos',
		HANDLE_SIZE : 'handleSize'
};

mxShapeGmdlSlider2.prototype.customProperties = [
	{name:'barPos', dispName:'Handle Position', type:'float', min:0, defVal:40},
	{name:'handleSize', dispName:'Handle Size', type:'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGmdlSlider2.prototype.paintVertexShape = function(c, x, y, w, h)
{
	
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(true);
};

mxShapeGmdlSlider2.prototype.background = function(c, x, y, w, h)
{
	var hSize = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSlider2.prototype.cst.HANDLE_SIZE, '10'));
	var barPos = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSlider2.prototype.cst.BAR_POS, '40')) / 100;

	barPos = Math.max(0, Math.min(1, barPos));

	c.save();
	c.setStrokeColor('#bbbbbb');
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.fillAndStroke();
	
	c.restore();
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(barPos * w, h * 0.5);
	c.fillAndStroke();
	
	c.begin();
	c.ellipse(barPos * w - hSize * 0.5, h * 0.5 - hSize * 0.5, hSize, hSize);
	c.fillAndStroke();

};

mxCellRenderer.registerShape(mxShapeGmdlSlider2.prototype.cst.SHAPE_SLIDER, mxShapeGmdlSlider2);

mxShapeGmdlSlider2.prototype.constraints = null;

Graph.handleFactory[mxShapeGmdlSlider2.prototype.cst.SHAPE_SLIDER] = function(state)
{
	var handles = [Graph.createHandle(state, ['barPos'], function(bounds)
			{
				var barPos = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'barPos', 0.4))));

				return new mxPoint(bounds.x + barPos * bounds.width / 100, bounds.y + bounds.height / 2);
			}, function(bounds, pt)
			{
				this.state.style['barPos'] = Math.round(100 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 100;
			})];
			
	return handles;
};

//**********************************************************************************************************************************************************
//slider focused v2
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGmdlSliderFocused(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeGmdlSliderFocused, mxShape);

mxShapeGmdlSliderFocused.prototype.cst = {
		SHAPE_SLIDER_FOCUSED : 'mxgraph.gmdl.sliderFocused',
		BAR_POS : 'barPos',
		HANDLE_SIZE : 'handleSize'
};

mxShapeGmdlSliderFocused.prototype.customProperties = [
	{name:'barPos', dispName:'Handle Position', type:'float', min:0, defVal:40},
	{name:'handleSize', dispName:'Handle Size', type:'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGmdlSliderFocused.prototype.paintVertexShape = function(c, x, y, w, h)
{
	
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(true);
};

mxShapeGmdlSliderFocused.prototype.background = function(c, x, y, w, h)
{
	var hSize = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSliderFocused.prototype.cst.HANDLE_SIZE, '10'));
	var barPos = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSliderFocused.prototype.cst.BAR_POS, '40')) / 100;
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#ffffff');

	barPos = Math.max(0, Math.min(1, barPos));

	c.save();
	c.setStrokeColor('#bbbbbb');
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.fillAndStroke();

	c.restore();
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(barPos * w, h * 0.5);
	c.fillAndStroke();
	
	c.begin();
	c.ellipse(barPos * w - hSize * 0.167, h * 0.5 - hSize * 0.167, hSize * 0.33, hSize * 0.33);
	c.fillAndStroke();

	c.setFillColor(strokeColor);
	c.setAlpha(0.15);
	c.begin();
	c.ellipse(barPos * w - hSize * 0.5, h * 0.5 - hSize * 0.5, hSize, hSize);
	c.fill();

};

mxCellRenderer.registerShape(mxShapeGmdlSliderFocused.prototype.cst.SHAPE_SLIDER_FOCUSED, mxShapeGmdlSliderFocused);

mxShapeGmdlSliderFocused.prototype.constraints = null;

Graph.handleFactory[mxShapeGmdlSliderFocused.prototype.cst.SHAPE_SLIDER_FOCUSED] = function(state)
{
	var handles = [Graph.createHandle(state, ['barPos'], function(bounds)
			{
				var barPos = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'barPos', 0.4))));

				return new mxPoint(bounds.x + barPos * bounds.width / 100, bounds.y + bounds.height / 2);
			}, function(bounds, pt)
			{
				this.state.style['barPos'] = Math.round(100 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 100;
			})];
			
	return handles;

};

//**********************************************************************************************************************************************************
//slider disabled
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGmdlSliderDisabled(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeGmdlSliderDisabled, mxShape);

mxShapeGmdlSliderDisabled.prototype.cst = {
		SHAPE_SLIDER_DISABLED : 'mxgraph.gmdl.sliderDisabled',
		HANDLE_POSITION : 'hPos',
		HANDLE_SIZE : 'handleSize'
};

mxShapeGmdlSliderDisabled.prototype.customProperties = [
	{name:'hPos', dispName:'Handle Position', type:'float', min:0, defVal:40},
	{name:'handleSize', dispName:'Handle Size', type:'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGmdlSliderDisabled.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(true);
};

mxShapeGmdlSliderDisabled.prototype.background = function(c, x, y, w, h)
{
	var hSize = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSliderDisabled.prototype.cst.HANDLE_SIZE, '10'));
	var hPos = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSliderDisabled.prototype.cst.HANDLE_POSITION, '50')) / 100;
	
	hPos = Math.max(hPos, 0);
	hPos = Math.min(hPos, 1);

	c.ellipse(w * hPos - hSize * 0.5, (h - hSize) * 0.5, hSize, hSize);
	c.fillAndStroke();
	
	var endL = w * hPos - 7;
	var startR = w * hPos + 7;
	
	if (endL > 0)
	{
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(endL, h * 0.5);
		c.stroke();
	}
	
	if (startR < w)
	{
		c.begin();
		c.moveTo(startR, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapeGmdlSliderDisabled.prototype.cst.SHAPE_SLIDER_DISABLED, mxShapeGmdlSliderDisabled);

//**********************************************************************************************************************************************************
//slider disabled v2
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGmdlSliderDisabled2(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeGmdlSliderDisabled2, mxShape);

mxShapeGmdlSliderDisabled2.prototype.cst = {
		SHAPE_SLIDER_DISABLED : 'mxgraph.gmdl.sliderDisabled2',
		HANDLE_POSITION : 'hPos',
		HANDLE_SIZE : 'handleSize'
};

mxShapeGmdlSliderDisabled2.prototype.customProperties = [
	{name:'hPos', dispName:'Handle Position', type:'float', min:0, defVal:'40'},
	{name:'handleSize', dispName:'Handle Size', type:'float', min:0, defVal:'10'}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGmdlSliderDisabled2.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(true);
};

mxShapeGmdlSliderDisabled2.prototype.background = function(c, x, y, w, h)
{
	var hSize = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSliderDisabled2.prototype.cst.HANDLE_SIZE, '10'));
	var hPos = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSliderDisabled2.prototype.cst.HANDLE_POSITION, '50')) / 100;
	
	hPos = Math.min(Math.max(hPos, 0), 1);

	c.ellipse(w * hPos - hSize * 0.5, (h - hSize) * 0.5, hSize, hSize);
	c.fillAndStroke();
	
	var endL = w * hPos - 7;
	var startR = w * hPos + 7;
	
	if (endL > 0)
	{
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(endL, h * 0.5);
		c.stroke();
	}
	
	if (startR < w)
	{
		c.begin();
		c.moveTo(startR, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapeGmdlSliderDisabled2.prototype.cst.SHAPE_SLIDER_DISABLED, mxShapeGmdlSliderDisabled2);

mxShapeGmdlSlider2.prototype.constraints = null;

Graph.handleFactory[mxShapeGmdlSliderDisabled2.prototype.cst.SHAPE_SLIDER_DISABLED] = function(state)
{
	var handles = [Graph.createHandle(state, ['hPos'], function(bounds)
			{
				var hPos = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'hPos', 0.4))));

				return new mxPoint(bounds.x + hPos * bounds.width / 100, bounds.y + bounds.height / 2);
			}, function(bounds, pt)
			{
				this.state.style['hPos'] = Math.round(100 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 100;
			})];
			
	return handles;
};

//**********************************************************************************************************************************************************
//slider discrete
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGmdlSliderDiscrete(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeGmdlSliderDiscrete, mxShape);

mxShapeGmdlSliderDiscrete.prototype.cst = {
		SHAPE_DISCRETE : 'mxgraph.gmdl.sliderDiscrete',
		BAR_POS : 'barPos',
		HANDLE_SIZE : 'handleSize'
};

mxShapeGmdlSliderDiscrete.prototype.customProperties = [
	{name:'barPos', dispName:'Handle Position', type:'int', min:0, defVal:'40'},
	{name:'handleSize', dispName:'Handle Size', type:'float', min:0, defVal:'10'}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGmdlSliderDiscrete.prototype.paintVertexShape = function(c, x, y, w, h)
{
	
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(true);
};

mxShapeGmdlSliderDiscrete.prototype.background = function(c, x, y, w, h)
{
	var hSize = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSliderDiscrete.prototype.cst.HANDLE_SIZE, '10'));
	var barPos = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSliderDiscrete.prototype.cst.BAR_POS, '40')) / 100;
	var fontSize = parseFloat(mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '12'));
	var fontColor = mxUtils.getValue(this.style, mxConstants.STYLE_FONTCOLOR, '#000000');

	barPos = Math.max(0, Math.min(1, barPos));

	c.save();
	c.setStrokeColor('#bbbbbb');
	c.begin();
	c.moveTo(0, h * 0.5 + 22.5);
	c.lineTo(w, h * 0.5 + 22.5);
	c.fillAndStroke();
	
	c.restore();
	c.begin();
	c.moveTo(0, h * 0.5 + 22.5);
	c.lineTo(barPos * w, h * 0.5 + 22.5);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(barPos * w, h * 0.5 + 15.5);
	c.lineTo(barPos * w - 10.5, h * 0.5 + 2.5);
	c.arcTo(15, 15, 0, 0, 1, barPos * w, h * 0.5 - 22.5);
	c.arcTo(15, 15, 0, 0, 1, barPos * w + 10.5, h * 0.5 + 2.5);
	c.close();
	c.fillAndStroke();

	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	var p = Math.round(barPos * 100);
	c.text(barPos * w, h * 0.5 - 9, 0, 0, p.toString() , mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeGmdlSliderDiscrete.prototype.cst.SHAPE_DISCRETE, mxShapeGmdlSliderDiscrete);

mxShapeGmdlSliderDiscrete.prototype.constraints = null;

Graph.handleFactory[mxShapeGmdlSliderDiscrete.prototype.cst.SHAPE_DISCRETE] = function(state)
{
	var handles = [Graph.createHandle(state, ['barPos'], function(bounds)
			{
				var barPos = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'barPos', 0.4))));

				return new mxPoint(bounds.x + barPos * bounds.width / 100, bounds.y + bounds.height / 2 + 22.5);
			}, function(bounds, pt)
			{
				this.state.style['barPos'] = Math.round(100 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 100;
			})];
			
	return handles;
};

//**********************************************************************************************************************************************************
//slider discrete with dots
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGmdlSliderDiscreteDots(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeGmdlSliderDiscreteDots, mxShape);

mxShapeGmdlSliderDiscreteDots.prototype.cst = {
		SHAPE_DISCRETE_DOTS : 'mxgraph.gmdl.sliderDiscreteDots',
		BAR_POS : 'barPos',
		HANDLE_SIZE : 'handleSize'
};

mxShapeGmdlSliderDiscreteDots.prototype.customProperties = [
	{name:'barPos', dispName:'Handle Position', type:'int', min:0, defVal:'40'},
	{name:'handleSize', dispName:'Handle Size', type:'float', min:0, defVal:'10'}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGmdlSliderDiscreteDots.prototype.paintVertexShape = function(c, x, y, w, h)
{
	
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(true);
};

mxShapeGmdlSliderDiscreteDots.prototype.background = function(c, x, y, w, h)
{
	var hSize = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSliderDiscreteDots.prototype.cst.HANDLE_SIZE, '10'));
	var barPos = parseFloat(mxUtils.getValue(this.style, mxShapeGmdlSliderDiscreteDots.prototype.cst.BAR_POS, '40')) / 100;
	var fontSize = parseFloat(mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '12'));
	var fontColor = mxUtils.getValue(this.style, mxConstants.STYLE_FONTCOLOR, '#000000');
	var bright = mxUtils.getValue(this.style, 'bright', '1');

	barPos = Math.max(0, Math.min(1, barPos));

	c.save();
	c.setStrokeColor('#bebebe');
	c.begin();
	c.moveTo(0, h * 0.5 + 22.5);
	c.lineTo(w, h * 0.5 + 22.5);
	c.fillAndStroke();
	
	c.restore();

	if (barPos <= 0.1)
	{
		c.setFillColor('#bebebe');
	}
	
	c.begin();
	c.moveTo(0, h * 0.5 + 22.5);
	c.lineTo(barPos * w, h * 0.5 + 22.5);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(barPos * w, h * 0.5 + 15.5);
	c.lineTo(barPos * w - 10.5, h * 0.5 + 2.5);
	c.arcTo(15, 15, 0, 0, 1, barPos * w, h * 0.5 - 22.5);
	c.arcTo(15, 15, 0, 0, 1, barPos * w + 10.5, h * 0.5 + 2.5);
	c.close();
	c.fill();
	
	if (bright == '1')
	{
		c.setFillColor('#000000');
	}
	else
	{
		c.setFillColor('#ffffff');
	}
	
	c.ellipse(-1.5, h * 0.5 + 21, 3, 3);
	c.fill();
	
	c.ellipse(w * 0.2 - 1.5, h * 0.5 + 21, 3, 3);
	c.fill();
	
	c.ellipse(w * 0.4 - 1.5, h * 0.5 + 21, 3, 3);
	c.fill();
	
	c.ellipse(w * 0.6 - 1.5, h * 0.5 + 21, 3, 3);
	c.fill();
	
	c.ellipse(w * 0.8 - 1.5, h * 0.5 + 21, 3, 3);
	c.fill();
	
	c.ellipse(w - 1.5, h * 0.5 + 21, 3, 3);
	c.fill();
	
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	var p = Math.round(barPos * 100);
	c.text(barPos * w, h * 0.5 - 9, 0, 0, p.toString() , mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeGmdlSliderDiscreteDots.prototype.cst.SHAPE_DISCRETE_DOTS, mxShapeGmdlSliderDiscreteDots);

mxShapeGmdlSliderDiscreteDots.prototype.constraints = null;

Graph.handleFactory[mxShapeGmdlSliderDiscreteDots.prototype.cst.SHAPE_DISCRETE_DOTS] = function(state)
{
	var handles = [Graph.createHandle(state, ['barPos'], function(bounds)
			{
				var barPos = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'barPos', 0.4))));

				return new mxPoint(bounds.x + barPos * bounds.width / 100, bounds.y + bounds.height / 2 + 22.5);
			}, function(bounds, pt)
			{
				this.state.style['barPos'] = Math.round(0.05 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 0.05;
			})];
			
	return handles;
};

//**********************************************************************************************************************************************************
//Progress Bar
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeGmdlProgressBar(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.dx1 = 0.8;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeGmdlProgressBar, mxShape);

mxShapeGmdlProgressBar.prototype.cst = {
		PROGRESS_BAR : 'mxgraph.gmdl.progressBar'
};

mxShapeGmdlProgressBar.prototype.customProperties = [
	{name:'dx1', dispName:'Handle Position', type:'int', min:0, defVal:0.8}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeGmdlProgressBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var dx1 = w * Math.max(0, Math.min(w, parseFloat(mxUtils.getValue(this.style, 'dx1', this.dx1))));

	c.translate(x, y);
	
	c.save();
	c.setStrokeColor('#aaaaaa');
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w , h * 0.5);
	c.stroke();
	
	c.restore();
	c.setShadow(false);
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(dx1, h * 0.5);
	c.stroke();
	
};

mxCellRenderer.registerShape(mxShapeGmdlProgressBar.prototype.cst.PROGRESS_BAR, mxShapeGmdlProgressBar);

mxShapeGmdlProgressBar.prototype.constraints = null;

Graph.handleFactory[mxShapeGmdlProgressBar.prototype.cst.PROGRESS_BAR] = function(state)
{
	var handles = [Graph.createHandle(state, ['dx1'], function(bounds)
			{
				var dx1 = Math.max(0, Math.min(1, parseFloat(mxUtils.getValue(this.state.style, 'dx1', this.dx1))));

				return new mxPoint(bounds.x + dx1 * bounds.width, bounds.y + bounds.height / 2);
			}, function(bounds, pt)
			{
				this.state.style['dx1'] = Math.round(100 * Math.max(0, Math.min(1, (pt.x - bounds.x) / bounds.width))) / 100;
			})];

	var handle2 = Graph.createHandle(state, ['dx2'], function(bounds)
			{
				var dx2 = Math.max(0, Math.min(1, parseFloat(mxUtils.getValue(this.state.style, 'dx2', this.dx1))));

				return new mxPoint(bounds.x + dx2 * bounds.width, bounds.y + bounds.height / 2);
			}, function(bounds, pt)
			{
				this.state.style['dx2'] = Math.round(100 * Math.max(0, Math.min(1, (pt.x - bounds.x) / bounds.width))) / 100;
			});
	
	handles.push(handle2);

	return handles;
};

