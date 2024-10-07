/**
 * $Id: mxBpmnShape2.js,v 1.6 2013/12/20 09:54:28 mate Exp $
 * Copyright (c) 2006-2010, JGraph Ltd
 */
/**
 * Class: mxBpmnShape
 *
 * Extends <mxShape> to implement an cylinder shape. If a
 * custom shape with one filled area and an overlay path is
 * needed, then this shape's <redrawPath> should be overridden.
 * This shape is registered under <mxConstants.SHAPE_CYLINDER>
 * in <mxCellRenderer>.
 * 
 * Constructor: mxBpmnShape
 *
 * Constructs a new cylinder shape.
 * 
 * Parameters:
 * 
 * bounds - <mxRectangle> that defines the bounds. This is stored in
 * <mxShape.bounds>.
 * fill - String that defines the fill color. This is stored in <fill>.
 * stroke - String that defines the stroke color. This is stored in <stroke>.
 * strokewidth - Optional integer that defines the stroke width. Default is
 * 1. This is stored in <strokewidth>.
 */
function mxBpmnShape(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxBpmnShape, mxShape);

mxBpmnShape.prototype.customProperties = [
	{name: 'symbol', dispName: 'Event', type: 'enum', defVal:'general', 
		enumList: [{val: 'general', dispName: 'General'}, 
				   {val: 'message', dispName: 'Message'}, 
				   {val: 'timer', dispName: 'Timer'}, 
				   {val: 'escalation', dispName: 'Escalation'}, 
				   {val: 'conditional', dispName: 'Conditional'}, 
				   {val: 'link', dispName: 'Link'}, 
				   {val: 'error', dispName: 'Error'}, 
				   {val: 'cancel', dispName: 'Cancel'}, 
				   {val: 'compensation', dispName: 'Compensation'}, 
				   {val: 'signal', dispName: 'Signal'}, 
				   {val: 'multiple', dispName: 'Multiple'}, 
				   {val: 'parallelMultiple', dispName: 'Parallel Multiple'}, 
				   {val: 'terminate', dispName: 'Terminate'}, 
				   {val: 'exclusiveGw', dispName: 'Exclusive Gw'}, 
				   {val: 'parallelGw', dispName: 'Parallel Gw'}, 
				   {val: 'complexGw', dispName: 'Complex Gw'}]
	},
	{name: 'outline', dispName: 'Event Type', type: 'enum', defVal:'standard', 
		enumList: [{val: 'standard', dispName: 'Standard'}, 
				   {val: 'eventInt', dispName: 'Interrupting'}, 
				   {val: 'eventNonint', dispName: 'Non-Interrupting'}, 
				   {val: 'catching', dispName: 'Catching'}, 
				   {val: 'boundInt', dispName: 'Bound Interrupting'}, 
				   {val: 'boundNonint', dispName: 'Bound Non-Interrupting'}, 
				   {val: 'throwing', dispName: 'Throwing'}, 
				   {val: 'end', dispName: 'End'}, 
				   {val: 'none', dispName: 'None'}]
	},
	{name: 'background', dispName: 'Background', type: 'enum', defVal:'none',
		enumList: [{val: 'gateway', dispName: 'Gateway'}, 
				   {val: 'none', dispName: 'None'}]
}];

mxBpmnShape.prototype.eventTypeEnum = { 
		START_STANDARD : 'standard', 
		EVENT_SP_INT : 'eventInt', 
		EVENT_SP_NONINT : 'eventNonint',
		CATCHING : 'catching',
		BOUND_INT : 'boundInt',
		BOUND_NONINT : 'boundNonint',
		THROWING : 'throwing',
		END : 'end',
		NONE : 'none',
		GATEWAY : 'gateway'};

mxBpmnShape.prototype.eventEnum = { 
		GENERAL 		: 'general', 
		MESSAGE 		: 'message', 
		TIMER 			: 'timer', 
		ESCALATION 		: 'escalation', 
		CONDITIONAL 	: 'conditional', 
		LINK 			: 'link', 
		ERROR			: 'error', 
		CANCEL			: 'cancel', 
		COMPENSATION 	: 'compensation', 
		SIGNAL 			: 'signal', 
		MULTIPLE		: 'multiple', 
		PAR_MULTI		: 'parallelMultiple', 
		TERMINATE		: 'terminate',
		GW_EXCLUSIVE 	: 'exclusiveGw',
		GW_PARALLEL		: 'parallelGw',
		GW_COMPLEX		: 'complexGw'};

mxBpmnShape.prototype.miscEnum = {
		OUTLINE			: 'outline',
		BACKGROUND		: 'background',
		SYMBOL			: 'symbol',
		GATEWAY			: 'gateway'};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxBpmnShape.prototype.paintVertexShape = function(c, x, y, w, h)
{
	this.redrawPath(c, x, y, w, h, mxBpmnShape.prototype.miscEnum.BACKGROUND);
	var bg = mxUtils.getValue(this.style, mxBpmnShape.prototype.miscEnum.BACKGROUND, mxBpmnShape.prototype.eventTypeEnum.NONE);

	if (bg === mxBpmnShape.prototype.eventTypeEnum.GATEWAY)
	{
		c.setShadow(false);
	}

	this.redrawPath(c, x, y, w, h, mxBpmnShape.prototype.miscEnum.OUTLINE);
	this.redrawPath(c, x, y, w, h, mxBpmnShape.prototype.miscEnum.SYMBOL);
};

/**
 * Function: redrawPath
 *
 * Draws the path for this shape.
 */
mxBpmnShape.prototype.redrawPath = function(c, x, y, w, h, layer)
{
	var bg = mxUtils.getValue(this.style, mxBpmnShape.prototype.miscEnum.BACKGROUND, mxBpmnShape.prototype.eventTypeEnum.NONE);

	if (layer == mxBpmnShape.prototype.miscEnum.BACKGROUND)
	{
		if (bg != null)
		{
			var f = this.backgrounds[bg];

			if (f != null)
			{
				c.translate(x, y);
				f.call(this, c, x, y, w, h, layer);
			}
		}
	}
	else if (layer == mxBpmnShape.prototype.miscEnum.OUTLINE)
	{
		if (bg === mxBpmnShape.prototype.eventTypeEnum.GATEWAY)
		{
			c.translate(w / 4, h / 4);
			h /= 2;
			w /= 2;
			
			//add rhombus connections here
			this.constraints = [
			                                      new mxConnectionConstraint(new mxPoint(0.5, 0), true),
			                                      new mxConnectionConstraint(new mxPoint(0.5, 1), true),
			                                      new mxConnectionConstraint(new mxPoint(0, 0.5), true),
			                                      new mxConnectionConstraint(new mxPoint(1, 0.5), true),
			                                      new mxConnectionConstraint(new mxPoint(0.25, 0.25), false),
			                                      new mxConnectionConstraint(new mxPoint(0.25, 0.75), false),
			                                      new mxConnectionConstraint(new mxPoint(0.75, 0.25), false),
			                                      new mxConnectionConstraint(new mxPoint(0.75, 0.75), false)
			                                      ];
		}
		else
		{
			//add ellipse connections here
			this.constraints = [
			                                      new mxConnectionConstraint(new mxPoint(0.5, 0), true),
			                                      new mxConnectionConstraint(new mxPoint(0.5, 1), true),
			                                      new mxConnectionConstraint(new mxPoint(0, 0.5), true),
			                                      new mxConnectionConstraint(new mxPoint(1, 0.5), true),
			                                      new mxConnectionConstraint(new mxPoint(0.145, 0.145), false),
			                                      new mxConnectionConstraint(new mxPoint(0.145, 0.855), false),
			                                      new mxConnectionConstraint(new mxPoint(0.855, 0.145), false),
			                                      new mxConnectionConstraint(new mxPoint(0.855, 0.855), false)
			                                      ];
		}

		var o = mxUtils.getValue(this.style, mxBpmnShape.prototype.miscEnum.OUTLINE, mxBpmnShape.prototype.eventTypeEnum.NONE);

		if (o != null)
		{
			var f = this.outlines[o];

			if (f != null)
			{
				f.call(this, c, x, y, w, h, bg === mxBpmnShape.prototype.eventTypeEnum.GATEWAY);
			}
		}
	}
	else if (layer == mxBpmnShape.prototype.miscEnum.SYMBOL)
	{
		if (bg === mxBpmnShape.prototype.eventTypeEnum.GATEWAY)
		{
			h /= 2;
			w /= 2;
		}

		var s = mxUtils.getValue(this.style, mxBpmnShape.prototype.miscEnum.SYMBOL, null);

		if (s != null)
		{
			var f = this.symbols[s];
			var isInverse = false;
			if (f != null)
			{
				var strokeColor = c.state.strokeColor;
				var fillColor = c.state.fillColor;
				var o = mxUtils.getValue(this.style, mxBpmnShape.prototype.miscEnum.OUTLINE, mxBpmnShape.prototype.eventTypeEnum.NONE);

				if (s === mxBpmnShape.prototype.eventEnum.MESSAGE)
				{
					c.translate(w * 0.15, h * 0.3);
					w = w * 0.7;
					h = h * 0.4;
				}
				else if (s === mxBpmnShape.prototype.eventEnum.TIMER)
				{
					c.translate(w * 0.11, h * 0.11);
					w = w * 0.78;
					h = h * 0.78;
				}
				else if (s === mxBpmnShape.prototype.eventEnum.ESCALATION)
				{
					c.translate(w * 0.19, h * 0.15);
					w = w * 0.62;
					h = h * 0.57;
				}
				else if (s === mxBpmnShape.prototype.eventEnum.CONDITIONAL)
				{
					c.translate(w * 0.3, h * 0.16);
					w = w * 0.4;
					h = h * 0.68;
				}
				else if (s === mxBpmnShape.prototype.eventEnum.LINK)
				{
					c.translate(w * 0.27, h * 0.33);
					w = w * 0.46;
					h = h * 0.34;
				}
				else if (s === mxBpmnShape.prototype.eventEnum.ERROR)
				{
					c.translate(w * 0.212, h * 0.243);
					w = w * 0.58;
					h = h * 0.507;
				}
				else if (s === mxBpmnShape.prototype.eventEnum.CANCEL)
				{
					c.translate(w * 0.22, h * 0.22);
					w = w * 0.56;
					h = h * 0.56;
				}
				else if (s === mxBpmnShape.prototype.eventEnum.COMPENSATION)
				{
					c.translate(w * 0.28, h * 0.35);
					w = w * 0.44;
					h = h * 0.3;
				}
				else if (s === mxBpmnShape.prototype.eventEnum.SIGNAL)
				{
					c.translate(w * 0.19, h * 0.15);
					w = w * 0.62;
					h = h * 0.57;
				}
				else if (s === mxBpmnShape.prototype.eventEnum.MULTIPLE)
				{
					c.translate(w * 0.2, h * 0.19);
					w = w * 0.6;
					h = h * 0.565;
				}
				else if (s === mxBpmnShape.prototype.eventEnum.PAR_MULTI)
				{
					c.translate(w * 0.2, h * 0.2);
					w = w * 0.6;
					h = h * 0.6;
				}
				else if (s === mxBpmnShape.prototype.eventEnum.TERMINATE)
				{
					c.translate(w * 0.05, h * 0.05);
					w = w * 0.9;
					h = h * 0.9;
				}
				else if (s === mxBpmnShape.prototype.eventEnum.GW_EXCLUSIVE)
				{
					c.translate(w * 0.12, 0);
					w = w * 0.76;
				}
				
				isInverse = false;
				
				if (s === 'star')
				{
					c.setFillColor(strokeColor);
				}
				else if (o === mxBpmnShape.prototype.eventTypeEnum.THROWING || o === mxBpmnShape.prototype.eventTypeEnum.END)
				{
					c.setStrokeColor(fillColor);
					c.setFillColor(strokeColor);
					isInverse = true;
				}

				f.call(this, c, x, y, w, h, layer, isInverse);
				
				if (s === 'star')
				{
					c.setFillColor(fillColor);
				}
				else if (o === mxBpmnShape.prototype.eventTypeEnum.THROWING || o === mxBpmnShape.prototype.eventTypeEnum.END)
				{
					c.setStrokeColor(strokeColor);
					c.setFillColor(fillColor);
				}
			}
		}
	}
};

//Contains all possible backgrounds
mxBpmnShape.prototype.backgrounds = {
		'none': function(c, x, y, w, h)
		{
		},
		'gateway': function(c, x, y, w, h)
		{
			c.begin();
			c.moveTo(w / 2, 0);
			c.lineTo(w, h / 2);
			c.lineTo(w / 2, h);
			c.lineTo(0, h / 2);
			c.close();
			c.fillAndStroke();
		}
};

//Contains all possible outlines
mxBpmnShape.prototype.outlines = {
		'none' : function(c, x, y, w, h, isGateway)
		{
			if (!isGateway)
			{
				c.setShadow(false);
			}
		},
		'standard': function(c, x, y, w, h, isGateway)
		{
			c.ellipse(0, 0, w, h);
			c.fillAndStroke();

			if (!isGateway)
			{
				c.setShadow(false);
			}
		},
		'eventInt': function(c, x, y, w, h, isGateway)
		{
			c.ellipse(0, 0, w, h);
			c.fillAndStroke();

			if (!isGateway)
			{
				c.setShadow(false);
			}
		},
		'eventNonint': function(c, x, y, w, h, isGateway)
		{
			var dashed = c.state.dashed;
			c.setDashed(true);
			c.ellipse(0, 0, w, h);
			c.fillAndStroke();
			c.setDashed(dashed);

			if (!isGateway)
			{
				c.setShadow(false);
			}

		},
		'catching': function(c, x, y, w, h, isGateway)
		{
			c.ellipse(0, 0, w, h);
			c.fillAndStroke();

			if (!isGateway)
			{
				c.setShadow(false);
			}

			var inset = 2;
			c.ellipse(inset, inset, w - 2 *inset, h - 2 * inset);
			c.stroke();
		},
		'boundInt': function(c, x, y, w, h, isGateway)
		{
			c.ellipse(0, 0, w, h);
			c.fillAndStroke();

			if (!isGateway)
			{
				c.setShadow(false);
			}
			var inset = 2;
			c.ellipse(inset, inset, w - 2 *inset, h - 2 * inset);
			c.stroke();
		},
		'boundNonint': function(c, x, y, w, h, isGateway)
		{
			var dashed = c.state.dashed;
			c.setDashed(true);
			c.ellipse(0, 0, w, h);
			c.fillAndStroke();

			if (!isGateway)
			{
				c.setShadow(false);
			}

			var inset = 2;
			c.ellipse(inset, inset, w - 2 *inset, h - 2 * inset);
			c.stroke();
			c.setDashed(dashed);
		},
		'throwing': function(c, x, y, w, h, isGateway)
		{
			c.ellipse(0, 0, w, h);
			c.fillAndStroke();

			if (!isGateway)
			{
				c.setShadow(false);
			}

			var inset = 2;
			c.ellipse(w * 0.02 + inset, h * 0.02 + inset, w * 0.96 - 2 *inset, h * 0.96 - 2 * inset);
			c.stroke();
		},
		'end': function(c, x, y, w, h, isGateway)
		{
			var sw = c.state.strokeWidth;
			c.setStrokeWidth(sw * 3);
			c.ellipse(0, 0, w, h);
			c.fillAndStroke();
			c.setStrokeWidth(sw);

			if (!isGateway)
			{
				c.setShadow(false);
			}
		}
};

//Contains all possible symbols
mxBpmnShape.prototype.symbols = {
		'general' : function(c, x, y, w, h)
		{
		},
		'message': function(c, x, y, w, h, layer, isInverse)
		{
			c.rect(0, 0, w, h);
			c.fillAndStroke();

			var fc = mxUtils.getValue(this.style, "fillColor", "none");

			if (fc === 'none')
			{
				if (isInverse)
				{
					c.setStrokeColor('#ffffff');
				}
			}
			
			c.begin();
			c.moveTo(0, 0);
			c.lineTo(w * 0.5, h * 0.5);
			c.lineTo(w, 0);
			c.stroke();
		},
		'timer' : function(c, x, y, w, h)
		{
			c.ellipse(0, 0, w, h);
			c.fillAndStroke();

			c.begin();
			c.moveTo(w * 0.5, 0);
			c.lineTo(w * 0.5, h * 0.0642);
			c.moveTo(w * 0.7484, h * 0.0654);
			c.lineTo(w * 0.7126, h * 0.1281);
			c.moveTo(w * 0.93, h * 0.2471);
			c.lineTo(w * 0.8673, h * 0.2854);
			c.moveTo(w, h * 0.5);
			c.lineTo(w * 0.9338, h * 0.5);
			c.moveTo(w * 0.93, h * 0.7509);
			c.lineTo(w * 0.8673, h * 0.7126);
			c.moveTo(w * 0.7484, h * 0.9326);
			c.lineTo(w * 0.7126, h * 0.8699);
			c.moveTo(w * 0.5, h * 0.9338);
			c.lineTo(w * 0.5, h);
			c.moveTo(w * 0.2496, h * 0.9325);
			c.lineTo(w * 0.2854, h * 0.8699);
			c.moveTo(w * 0.068, h * 0.7509);
			c.lineTo(w * 0.1307, h * 0.7126);
			c.moveTo(0, h * 0.5);
			c.lineTo(w * 0.0642, h * 0.5);
			c.moveTo(w * 0.068, h * 0.2471);
			c.lineTo(w * 0.1307, h * 0.2854);
			c.moveTo(w * 0.2496, h * 0.0654);
			c.lineTo(w * 0.2854, h * 0.1281);
			c.moveTo(w * 0.5246, h * 0.0706);
			c.lineTo(w * 0.5, h * 0.5);
			c.lineTo(w * 0.7804, h * 0.5118);	
			c.stroke();
		},
		'escalation' : function(c, x, y, w, h)
		{
			c.begin();
			c.moveTo(0, h);
			c.lineTo(w * 0.5, 0);
			c.lineTo(w, h);
			c.lineTo(w * 0.5, h * 0.5);
			c.close();
			c.fillAndStroke();
		},
		'conditional' : function(c, x, y, w, h)
		{
			c.rect(0, 0, w, h);
			c.fillAndStroke();
			c.begin();
			c.moveTo(0, h * 0.1027);
			c.lineTo(w * 0.798, h * 0.1027);
			c.moveTo(0, h * 0.3669);
			c.lineTo(w * 0.798, h * 0.3669);
			c.moveTo(0, h * 0.6311);
			c.lineTo(w * 0.798, h * 0.6311);
			c.moveTo(0, h * 0.8953);
			c.lineTo(w * 0.798, h * 0.8953);
			c.stroke();
		},
		'link' : function(c, x, y, w, h)
		{
			c.begin();
			c.moveTo(0, h * 0.76);
			c.lineTo(0, h * 0.24);
			c.lineTo(w * 0.63, h * 0.24);
			c.lineTo(w * 0.63, 0);
			c.lineTo(w, h * 0.5);
			c.lineTo(w * 0.63, h);
			c.lineTo(w * 0.63, h * 0.76);
			c.close();
			c.fillAndStroke();
		},
		'error' : function(c, x, y, w, h)
		{
			c.begin();
			c.moveTo(0, h);
			c.lineTo(w * 0.3287, h * 0.123);
			c.lineTo(w * 0.6194, h * 0.6342);
			c.lineTo(w, 0);
			c.lineTo(w * 0.6625, h * 0.939);
			c.lineTo(w * 0.3717, h * 0.5064);
			c.close();
			c.fillAndStroke();
		},
		'cancel' : function(c, x, y, w, h)
		{
			c.begin();
			c.moveTo(w * 0.1051, 0);
			c.lineTo(w * 0.5, h * 0.3738);
			c.lineTo(w * 0.8909, 0);
			c.lineTo(w, h * 0.1054);
			c.lineTo(w * 0.623, h * 0.5);
			c.lineTo(w, h * 0.8926);
			c.lineTo(w * 0.8909, h);
			c.lineTo(w * 0.5, h * 0.6242);
			c.lineTo(w * 0.1051, h);
			c.lineTo(0, h * 0.8926);
			c.lineTo(w * 0.373, h * 0.5);
			c.lineTo(0, h * 0.1054);
			c.close();
			c.fillAndStroke();
		},
		'compensation' : function(c, x, y, w, h)
		{
			c.begin();
			c.moveTo(0, h * 0.5);
			c.lineTo(w * 0.5, 0);
			c.lineTo(w * 0.5, h);
			c.close();
			c.moveTo(w * 0.5, h * 0.5);
			c.lineTo(w, 0);
			c.lineTo(w, h);
			c.close();
			c.fillAndStroke();
		},
		'signal' : function(c, x, y, w, h)
		{
			c.begin();
			c.moveTo(0, h);
			c.lineTo(w * 0.5, 0);
			c.lineTo(w, h);
			c.close();
			c.fillAndStroke();
		},
		'multiple' : function(c, x, y, w, h)
		{
			c.begin();
			c.moveTo(0, h * 0.39);
			c.lineTo(w * 0.5, 0);
			c.lineTo(w, h * 0.39);
			c.lineTo(w * 0.815, h);
			c.lineTo(w * 0.185, h);
			c.close();
			c.fillAndStroke();
		},
		'parallelMultiple' : function(c, x, y, w, h)
		{
			c.begin();
			c.moveTo(w * 0.38, 0);
			c.lineTo(w * 0.62, 0);
			c.lineTo(w * 0.62, h * 0.38);
			c.lineTo(w, h * 0.38);
			c.lineTo(w, h * 0.62);
			c.lineTo(w * 0.62, h * 0.62);
			c.lineTo(w * 0.62, h);
			c.lineTo(w * 0.38, h);
			c.lineTo(w * 0.38, h * 0.62);
			c.lineTo(0, h * 0.62);
			c.lineTo(0, h * 0.38);
			c.lineTo(w * 0.38, h * 0.38);
			c.close();
			c.fillAndStroke();
		},
		'terminate' : function(c, x, y, w, h)
		{
			c.ellipse(0, 0, w, h);
			c.fillAndStroke();
		},
		'exclusiveGw' : function(c, x, y, w, h)
		{
			var strokeColor = c.state.strokeColor;
			var fillColor = c.state.fillColor;
			c.setStrokeColor(fillColor);
			c.setFillColor(strokeColor);

			c.begin();
			c.moveTo(w * 0.105, 0);
			c.lineTo(w * 0.5, h * 0.38);
			c.lineTo(w * 0.895, h * 0);
			c.lineTo(w, h * 0.11);
			c.lineTo(w * 0.6172, h * 0.5);
			c.lineTo(w, h * 0.89);
			c.lineTo(w * 0.895, h);
			c.lineTo(w * 0.5, h * 0.62);
			c.lineTo(w * 0.105, h);
			c.lineTo(0, h * 0.89);
			c.lineTo(w * 0.3808, h * 0.5);
			c.lineTo(0, h * 0.11);
			c.close();
			c.fillAndStroke();

			c.setStrokeColor(strokeColor);
			c.setFillColor(fillColor);

		},
		'parallelGw' : function(c, x, y, w, h)
		{
			var strokeColor = c.state.strokeColor;
			var fillColor = c.state.fillColor;
			c.setStrokeColor(fillColor);
			c.setFillColor(strokeColor);

			c.begin();
			c.moveTo(w * 0.38, 0);
			c.lineTo(w * 0.62, 0);
			c.lineTo(w * 0.62, h * 0.38);
			c.lineTo(w, h * 0.38);
			c.lineTo(w, h * 0.62);
			c.lineTo(w * 0.62, h * 0.62);
			c.lineTo(w * 0.62, h);
			c.lineTo(w * 0.38, h);
			c.lineTo(w * 0.38, h * 0.62);
			c.lineTo(0, h * 0.62);
			c.lineTo(0, h * 0.38);
			c.lineTo(w * 0.38, h * 0.38);
			c.close();
			c.fillAndStroke();

			c.setStrokeColor(strokeColor);
			c.setFillColor(fillColor);
		},
		'complexGw' : function(c, x, y, w, h)
		{
			var strokeColor = c.state.strokeColor;
			var fillColor = c.state.fillColor;
			c.setStrokeColor(fillColor);
			c.setFillColor(strokeColor);

			c.begin();
			c.moveTo(0, h * 0.44);
			c.lineTo(w * 0.36, h * 0.44);
			c.lineTo(w * 0.1, h * 0.18);
			c.lineTo(w * 0.18, h * 0.1);
			c.lineTo(w * 0.44, h * 0.36);
			c.lineTo(w * 0.44, 0);
			c.lineTo(w * 0.56, 0);
			c.lineTo(w * 0.56, h * 0.36);
			c.lineTo(w * 0.82, h * 0.1);
			c.lineTo(w * 0.90, h * 0.18);
			c.lineTo(w * 0.64, h * 0.44);
			c.lineTo(w, h * 0.44);
			c.lineTo(w, h * 0.56);
			c.lineTo(w * 0.64, h * 0.56);
			c.lineTo(w * 0.9, h * 0.82);
			c.lineTo(w * 0.82, h * 0.9);
			c.lineTo(w * 0.56, h * 0.64);
			c.lineTo(w * 0.56, h);
			c.lineTo(w * 0.44, h);
			c.lineTo(w * 0.44, h * 0.64);
			c.lineTo(w * 0.18, h * 0.9);
			c.lineTo(w * 0.1, h * 0.82);
			c.lineTo(w * 0.36, h * 0.56);
			c.lineTo(0, h * 0.56);
			c.close();
			c.fillAndStroke();

			c.setStrokeColor(strokeColor);
			c.setFillColor(fillColor);
		},
		'star': function(c, x, y, w, h)
		{
			c.translate(w / 5, h / 6);
			h *= 2 / 3;
			w *= 3 / 5;
			
			c.begin();
			c.moveTo(0, h / 4);
			c.lineTo(w / 3, h / 4);
			c.lineTo(w / 2, 0);
			c.lineTo(2 * w / 3, h / 4);
			c.lineTo(w, h / 4);
			c.lineTo(5 * w / 6, h / 2);
			c.lineTo(w, 3 * h / 4);
			c.lineTo(2 * w / 3, 3 * h / 4);
			c.lineTo(w / 2, h);
			c.lineTo(w / 3, 3 * h / 4);
			c.lineTo(0, 3 * h / 4);
			c.lineTo(w / 6, h / 2);
			c.close();
			c.fillAndStroke();
		}
};

mxCellRenderer.registerShape('mxgraph.bpmn.shape', mxBpmnShape);
