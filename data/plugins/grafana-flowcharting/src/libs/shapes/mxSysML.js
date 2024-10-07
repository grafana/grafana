/**
 * $Id: mxSysML.js,v 1.0 2014/07/23 07:05:39 mate Exp $
 * Copyright (c) 2006-2014, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Composite
//**********************************************************************************************************************************************************
function mxShapeSysMLComposite()
{
	mxCylinder.call(this);
};
	
mxUtils.extend(mxShapeSysMLComposite, mxShape);

mxShapeSysMLComposite.prototype.isHtmlAllowed = function()
{
	return false;
};

mxShapeSysMLComposite.prototype.paintForeground = function(c, x, y, w, h)
{
	if (this.style != null)
	{
		var shape = mxCellRenderer.defaultShapes[this.style['symbol0']];

		c.save();
			
		var tmp = new shape();
		tmp.style = this.style;
		shape.prototype.paintVertexShape.call(tmp, c, x, y, w, h);
		c.restore();

		c.setDashed(false);
			
		// Draws the symbols defined in the style. The symbols are
		// numbered from 1...n. Possible postfixes are align,
		// verticalAlign, spacing, arcSpacing, width, height
		var counter = 1;
			
		do
		{
			shape = mxCellRenderer.defaultShapes[this.style['symbol' + counter]];
				
			if (shape != null)
			{
				var align = this.style['symbol' + counter + 'Align'];
				var valign = this.style['symbol' + counter + 'VerticalAlign'];
				var width = this.style['symbol' + counter + 'Width'];
				var height = this.style['symbol' + counter + 'Height'];
				var spacing = this.style['symbol' + counter + 'Spacing'] || 0;
				var vspacing = this.style['symbol' + counter + 'VSpacing'] || 0;
				var arcspacing = this.style['symbol' + counter + 'ArcSpacing'];
				var direction = this.style['symbol' + counter + 'Direction'];
					
				if (arcspacing != null)
				{
					spacing += this.getArcSize(w + this.strokewidth, h + this.strokewidth) * arcspacing;
					vspacing += this.getArcSize(w + this.strokewidth, h + this.strokewidth) * arcspacing;
				}
					
				var x2 = x;
				var y2 = y;
					
				if (align == mxConstants.ALIGN_CENTER)
				{
					x2 += (w - width) / 2;
				}
				else if (align == mxConstants.ALIGN_RIGHT)
				{
					x2 += w - width - spacing;
				}
				else
				{
					x2 += spacing;
				}
					
				if (valign == mxConstants.ALIGN_MIDDLE)
				{
					y2 += (h - height) / 2;
				}
				else if (valign == mxConstants.ALIGN_BOTTOM)
				{
					y2 += h - height - vspacing;
				}
				else
				{
					y2 += vspacing;
				}
					
				c.save();
			
				var tmp = new shape();

				tmp.style = mxUtils.clone(this.style);
				tmp.direction = direction;
				tmp.updateTransform(c, x2, y2, width, height);
				shape.prototype.paintVertexShape.call(tmp, c, x2, y2, width, height);
				c.restore();
			}
				
			counter++;
		}
		while (shape != null);
	}
};

mxCellRenderer.registerShape('mxgraph.sysml.composite', mxShapeSysMLComposite);

//**********************************************************************************************************************************************************
//Package
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLPackage(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLPackage, mxShape);

mxShapeSysMLPackage.prototype.cst = {
		PACKAGE : 'mxgraph.sysml.package',
		LABEL_X : 'labelX'
};

mxShapeSysMLPackage.prototype.customProperties = [
	{name: 'labelX', dispName: 'Header Width', type: 'float', min:0, defVal:90} 
];

mxShapeSysMLPackage.prototype.getConstraints = function(style, w, h)
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

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLPackage.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeSysMLPackage.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeSysMLPackage.prototype.foreground = function(c, x, y, w, h)
{
	var xSize = parseInt(mxUtils.getValue(this.style, mxShapeSysMLPackage.prototype.cst.LABEL_X, '90'));
	var ySize = 20;
	
	xSize = Math.min(xSize, w);
	
	if (xSize > ySize)
	{
		c.begin();
		c.moveTo(0, ySize);
		c.lineTo(xSize - ySize * 0.5, ySize);
		c.lineTo(xSize, ySize * 0.5);
		c.lineTo(xSize, 0);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapeSysMLPackage.prototype.cst.PACKAGE, mxShapeSysMLPackage);

Graph.handleFactory[mxShapeSysMLPackage.prototype.cst.PACKAGE] = function(state)
{
	var handles = [Graph.createHandle(state, ['labelX'], function(bounds)
			{
				var labelX = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'labelX', 90))));

				return new mxPoint(bounds.x + labelX, bounds.y + 10);
			}, function(bounds, pt)
			{
				this.state.style['labelX'] = Math.round(100 * Math.max(0, Math.min(bounds.width, pt.x - bounds.x))) / 100;
			})];
	
	return handles;

}

//**********************************************************************************************************************************************************
//Package2
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLPackage2(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLPackage2, mxShape);

mxShapeSysMLPackage2.prototype.cst = {
		PACKAGE2 : 'mxgraph.sysml.package2',
		LABEL_X : 'labelX'
};

mxShapeSysMLPackage2.prototype.customProperties = [
	{name: 'labelX', dispName: 'Header Width', type: 'float', min:0, defVal:90} 
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLPackage2.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeSysMLPackage2.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.stroke();
};

mxShapeSysMLPackage2.prototype.foreground = function(c, x, y, w, h)
{
	var xSize = parseInt(mxUtils.getValue(this.style, mxShapeSysMLPackage2.prototype.cst.LABEL_X, '90'));
	var ySize = 20;
	
	xSize = Math.min(xSize, w);
	
	if (xSize > ySize)
	{
		c.begin();
		c.moveTo(0, ySize);
		c.lineTo(xSize - ySize * 0.5, ySize);
		c.lineTo(xSize, ySize * 0.5);
		c.lineTo(xSize, 0);
		c.lineTo(0, 0);
		c.close();
		c.fillAndStroke();
	}
};

mxCellRenderer.registerShape(mxShapeSysMLPackage2.prototype.cst.PACKAGE2, mxShapeSysMLPackage2);

Graph.handleFactory[mxShapeSysMLPackage2.prototype.cst.PACKAGE2] = function(state)
{
	var handles = [Graph.createHandle(state, ['labelX'], function(bounds)
			{
				var labelX = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'labelX', 90))));

				return new mxPoint(bounds.x + labelX, bounds.y + 10);
			}, function(bounds, pt)
			{
				this.state.style['labelX'] = Math.round(100 * Math.max(0, Math.min(bounds.width, pt.x - bounds.x))) / 100;
			})];
	
	return handles;

}

//**********************************************************************************************************************************************************
//None
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLNone(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLNone, mxShape);

mxShapeSysMLNone.prototype.cst = {
		NONE : 'mxgraph.sysml.none'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLNone.prototype.paintVertexShape = function(c, x, y, w, h)
{
};

mxCellRenderer.registerShape(mxShapeSysMLNone.prototype.cst.NONE, mxShapeSysMLNone);

//**********************************************************************************************************************************************************
//Rectangle
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLRect(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLRect, mxShape);

mxShapeSysMLRect.prototype.cst = {
		RECT : 'mxgraph.sysml.rect'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLRect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.rect(x, y, w, h);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLRect.prototype.cst.RECT, mxShapeSysMLRect);

//**********************************************************************************************************************************************************
//Port
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLPortOne(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLPortOne, mxShape);

mxShapeSysMLPortOne.prototype.cst = {
		PORT1 : 'mxgraph.sysml.port1'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLPortOne.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.rect(x + w * 0.05, y, w - w * 0.1, h);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLPortOne.prototype.cst.PORT1, mxShapeSysMLPortOne);

mxShapeSysMLPortOne.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0.05, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.95, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.95, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.95, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.95, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.05, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.05, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.05, 0.25), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Port2
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLPortTwo(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLPortTwo, mxShape);

mxShapeSysMLPortTwo.prototype.cst = {
		PORT2 : 'mxgraph.sysml.port2'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLPortTwo.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.rect(x + w * 0.05, y, w * 0.8, h);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLPortTwo.prototype.cst.PORT2, mxShapeSysMLPortTwo);

mxShapeSysMLPortTwo.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0.05, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.95, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.95, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.95, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.95, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.05, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.05, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.05, 0.25), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Port3
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLPortThree(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLPortThree, mxShape);

mxShapeSysMLPortThree.prototype.cst = {
		PORT3 : 'mxgraph.sysml.port3'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLPortThree.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.rect(x + w * 0.07, y, w * 0.86, h);
	c.fillAndStroke();
	c.rect(x, y + h * 0.125, w * 0.14, h * 0.25);
	c.fillAndStroke();
	c.rect(x, y + h * 0.625, w * 0.14, h * 0.25);
	c.fillAndStroke();
	c.rect(x + w * 0.86, y + h * 0.375, w * 0.14, h * 0.25);
	c.fillAndStroke();
	this.drawIn(c, x + w * 0.01, y + h * 0.2, w * 0.11, h * 0.10);
	this.drawOut(c, x + w * 0.02, y + h * 0.7, w * 0.11, h * 0.10);
	this.drawInOut(c, x + w * 0.88, y + h * 0.45, w * 0.1, h * 0.10);
};

mxShapeSysMLPortThree.prototype.drawIn = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(x, y + h * 0.5);
	c.lineTo(x + w, y + h * 0.5);
	c.moveTo(x + w * 0.75, y);
	c.lineTo(x + w, y + h * 0.5);
	c.lineTo(x + w * 0.75, y + h);
	c.stroke();
}

mxShapeSysMLPortThree.prototype.drawOut = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(x, y + h * 0.5);
	c.lineTo(x + w, y + h * 0.5);
	c.moveTo(x + w * 0.25, y);
	c.lineTo(x, y + h * 0.5);
	c.lineTo(x + w * 0.25, y + h);
	c.stroke();
}

mxShapeSysMLPortThree.prototype.drawInOut = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(x + w * 0.75, y);
	c.lineTo(x + w, y + h * 0.5);
	c.lineTo(x + w * 0.75, y + h);
	c.moveTo(x + w * 0.25, y);
	c.lineTo(x, y + h * 0.5);
	c.lineTo(x + w * 0.25, y + h);
	c.stroke();
}

mxCellRenderer.registerShape(mxShapeSysMLPortThree.prototype.cst.PORT3, mxShapeSysMLPortThree);

//**********************************************************************************************************************************************************
//Port
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLPortFour(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLPortFour, mxShape);

mxShapeSysMLPortFour.prototype.cst = {
		PORT4 : 'mxgraph.sysml.port4'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLPortFour.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.rect(x + w * 0.05, y, w - w * 0.05, h);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLPortFour.prototype.cst.PORT4, mxShapeSysMLPortFour);

mxShapeSysMLPortFour.prototype.constraints = [
                                                   new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                                   new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                                   new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                                   new mxConnectionConstraint(new mxPoint(1, 0.5), true)
                                                   ];

//**********************************************************************************************************************************************************
//Item Flow
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLItemFlow(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLItemFlow, mxShape);

mxShapeSysMLItemFlow.prototype.cst = {
		ITEM_FLOW : 'mxgraph.sysml.itemFlow',
		FLOW_DIR : 'flowDir',
		FLOW_TYPE : 'flowType'
};

mxShapeSysMLItemFlow.prototype.customProperties = [
	{name: 'flowDir', dispName: 'Flow Direction', type: 'enum',
		enumList:[
			{val:'n', dispName:'North'},
			{val:'s', dispName:'South'},
			{val:'e', dispName:'East'},
			{val:'w', dispName:'West'}
		]},
		{name: 'flowType', dispName: 'Flow Type', type: 'enum',
			enumList:[
				{val:'in', dispName:'In'},
				{val:'out', dispName:'Out'}
]}];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLItemFlow.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var flowDir = mxUtils.getValue(this.style, mxShapeSysMLItemFlow.prototype.cst.FLOW_DIR, 'none').toLowerCase();
	var flowType = mxUtils.getValue(this.style, mxShapeSysMLItemFlow.prototype.cst.FLOW_TYPE, 'none');
	
	if (flowDir === 'n')
	{
		c.rect(x, y + 10, w, h - 10);
		c.fillAndStroke();

		c.setShadow(false);
		
		c.rect(x + w * 0.5 - 10, y, 20, 20);
		c.fillAndStroke();
		
		if (flowType === 'in')
		{
			this.drawDown(c, x + w * 0.5 - 5, y + 2, 10, 16);
		}
		else if (flowType === 'out')
		{
			this.drawUp(c, x + w * 0.5 - 5, y + 2, 10, 16);
		}
	}
	else if (flowDir === 's')
	{
		c.rect(x, y, w, h - 10);
		c.fillAndStroke();

		c.setShadow(false);
		
		c.rect(x + w * 0.5 - 10, y + h - 20, 20, 20);
		c.fillAndStroke();

		if (flowType === 'in')
		{
			this.drawUp(c, x + w * 0.5 - 5, y + h - 18, 10, 16);
		}
		else if (flowType === 'out')
		{
			this.drawDown(c, x + w * 0.5 - 5, y + h - 18, 10, 16);
		}
	}
	else if (flowDir === 'w')
	{
		c.rect(x + 10, y, w - 10, h);
		c.fillAndStroke();

		c.setShadow(false);
		
		c.rect(x, y + h * 0.5 - 10, 20, 20);
		c.fillAndStroke();
		
		if (flowType === 'in')
		{
			this.drawRight(c, x + 2, y + h * 0.5 - 5, 16, 10);
		}
		else if (flowType === 'out')
		{
			this.drawLeft(c, x + 2, y + h * 0.5 - 5, 16, 10);
		}
	}
	else if (flowDir === 'e')
	{
		c.rect(x, y, w - 10, h);
		c.fillAndStroke();

		c.setShadow(false);
		
		c.rect(x + w - 20, y + h * 0.5 - 10, 20, 20);
		c.fillAndStroke();
		
		if (flowType === 'in')
		{
			this.drawLeft(c, x + w - 18, y + h * 0.5 - 5, 16, 10);
		}
		else if (flowType === 'out')
		{
			this.drawRight(c, x + w - 18, y + h * 0.5 - 5, 16, 10);
		}
	}
};

mxShapeSysMLItemFlow.prototype.drawRight = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(x, y + h * 0.5);
	c.lineTo(x + w, y + h * 0.5);
	c.moveTo(x + w * 0.75, y);
	c.lineTo(x + w, y + h * 0.5);
	c.lineTo(x + w * 0.75, y + h);
	c.stroke();
}

mxShapeSysMLItemFlow.prototype.drawDown = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(x + w * 0.5, y);
	c.lineTo(x + w * 0.5, y + h);
	c.moveTo(x, y + h * 0.75);
	c.lineTo(x + w * 0.5, y + h);
	c.lineTo(x + w, y + h * 0.75);
	c.stroke();
}

mxShapeSysMLItemFlow.prototype.drawLeft = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(x, y + h * 0.5);
	c.lineTo(x + w, y + h * 0.5);
	c.moveTo(x + w * 0.25, y);
	c.lineTo(x, y + h * 0.5);
	c.lineTo(x + w * 0.25, y + h);
	c.stroke();
}

mxShapeSysMLItemFlow.prototype.drawUp = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(x + w * 0.5, y + h);
	c.lineTo(x + w * 0.5, y);
	c.moveTo(x, y + h * 0.25);
	c.lineTo(x + w * 0.5, y);
	c.lineTo(x + w, y + h * 0.25);
	c.stroke();
}

mxCellRenderer.registerShape(mxShapeSysMLItemFlow.prototype.cst.ITEM_FLOW, mxShapeSysMLItemFlow);

mxShapeSysMLItemFlow.prototype.constraints = [
                                         new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                         new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                         new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                         new mxConnectionConstraint(new mxPoint(0, 0.5), true)
                                         ];

//**********************************************************************************************************************************************************
//Item Flow Left
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLItemFlowLeft(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLItemFlowLeft, mxShape);

mxShapeSysMLItemFlowLeft.prototype.cst = {
		ITEM_FLOW_LEFT : 'mxgraph.sysml.itemFlowLeft'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLItemFlowLeft.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.rect(x + 10, y, w - 10, h);
	c.fillAndStroke();
	c.rect(x, y + h * 0.25 - 10, 20, 20);
	c.fillAndStroke();
	c.rect(x, y + h * 0.5 - 10, 20, 20);
	c.fillAndStroke();
	c.rect(x, y + h * 0.75 - 10, 20, 20);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLItemFlowLeft.prototype.cst.ITEM_FLOW_LEFT, mxShapeSysMLItemFlowLeft);

mxShapeSysMLItemFlowLeft.prototype.constraints = [
                                              new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                              new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                              new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                              new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                              new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                              new mxConnectionConstraint(new mxPoint(0, 0.75), true)
                                              ];

//**********************************************************************************************************************************************************
//Item Flow Right
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLItemFlowRight(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLItemFlowRight, mxShape);

mxShapeSysMLItemFlowRight.prototype.cst = {
		ITEM_FLOW_RIGHT : 'mxgraph.sysml.itemFlowRight'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLItemFlowRight.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.rect(x, y, w - 10, h);
	c.fillAndStroke();
	c.rect(x + w - 20, y + h * 0.25 - 10, 20, 20);
	c.fillAndStroke();
	c.rect(x + w - 20, y + h * 0.5 - 10, 20, 20);
	c.fillAndStroke();
	c.rect(x + w - 20, y + h * 0.75 - 10, 20, 20);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLItemFlowRight.prototype.cst.ITEM_FLOW_RIGHT, mxShapeSysMLItemFlowRight);

mxShapeSysMLItemFlowRight.prototype.constraints = [
                                                  new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                                  new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                                  new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                                  new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                                  new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                                  new mxConnectionConstraint(new mxPoint(1, 0.75), true)
                                                  ];

//**********************************************************************************************************************************************************
//Nested Port
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLNestedPort(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLNestedPort, mxShape);

mxShapeSysMLNestedPort.prototype.cst = {
		NESTED_PORT : 'mxgraph.sysml.nestedPort'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLNestedPort.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.rect(x + w * 0.08, y, w * 0.92, h);
	c.fillAndStroke();
	c.rect(x + w * 0.03, y + h * 0.1, w * 0.1, h * 0.8);
	c.fillAndStroke();
	c.rect(x, y + h * 0.15, w * 0.06, h * 0.16);
	c.fillAndStroke();
	c.rect(x, y + h * 0.42, w * 0.06, h * 0.16);
	c.fillAndStroke();
	c.rect(x, y + h * 0.69, w * 0.06, h * 0.16);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLNestedPort.prototype.cst.NESTED_PORT, mxShapeSysMLNestedPort);

//**********************************************************************************************************************************************************
//Package Containment
//**********************************************************************************************************************************************************
mxMarker.addMarker('sysMLPackCont', function(c, shape, type, pe, unitX, unitY, size, source, sw, filled)
{
	var nx = unitX * (size + sw + 1);
	var ny = unitY * (size + sw + 1);
	var a = size / 2;

	return function()
	{
		c.begin();
		c.moveTo(pe.x - nx / 2 - ny / 2, pe.y - ny / 2 + nx / 2);
		c.lineTo(pe.x - nx / 2 + ny / 2, pe.y - ny / 2 - nx / 2);
		c.stroke();
		c.ellipse(pe.x - 0.5 * nx - a, pe.y - 0.5 * ny - a, 2 * a, 2 * a);
		c.stroke();
	};
});

//**********************************************************************************************************************************************************
//Required Interface
//**********************************************************************************************************************************************************
mxMarker.addMarker('sysMLReqInt', function(c, shape, type, pe, unitX, unitY, size, source, sw, filled)
{
	var nx = unitX * (size + sw + 1);
	var ny = unitY * (size + sw + 1);
	var a = size / 2;
	
	return function()
	{
		var fillColor = mxUtils.getValue(shape.style, mxConstants.STYLE_FILLCOLOR, 'none');
		c.setFillColor(fillColor);
		c.ellipse(pe.x - 0.5 * nx - a, pe.y - 0.5 * ny - a, 2 * a, 2 * a);
		c.fillAndStroke();
	};
});

//**********************************************************************************************************************************************************
//Provided Interface
//**********************************************************************************************************************************************************
mxMarker.addMarker('sysMLProvInt', function(c, shape, type, pe, unitX, unitY, size, source, sw, filled)
{
	var nx = unitX * (size + sw + 1);
	var ny = unitY * (size + sw + 1);
	var a = size / 2;
	
	return function()
	{
		var fillColor = mxUtils.getValue(shape.style, mxConstants.STYLE_FILLCOLOR, 'none');
		c.setFillColor(fillColor);
		c.begin();
		c.moveTo(pe.x - ny / 2, pe.y + nx / 2);
		c.arcTo(a, a, 0, 0, 1, pe.x + ny / 2, pe.y - nx / 2);
		c.fillAndStroke();
	};
});

//**********************************************************************************************************************************************************
//Parametric Diagram
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLParametricDiagram(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLParametricDiagram, mxShape);

mxShapeSysMLParametricDiagram.prototype.cst = {
		PARAM_DGM : 'mxgraph.sysml.paramDgm'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLParametricDiagram.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.roundrect(x, y, w, h, 10, 10);
	c.fillAndStroke();
	
	c.setShadow(false);
	
	if (h > 60)
	{
		c.rect(x, y + h * 0.25 - 10, 20, 20);
		c.stroke();
		c.rect(x, y + h * 0.75 - 10, 20, 20);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapeSysMLParametricDiagram.prototype.cst.PARAM_DGM, mxShapeSysMLParametricDiagram);

//**********************************************************************************************************************************************************
//Constraint Property
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLConstraintProperty(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLConstraintProperty, mxShape);

mxShapeSysMLConstraintProperty.prototype.cst = {
		CONS_PROP : 'mxgraph.sysml.consProp'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLConstraintProperty.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.rect(x, y, w, h);
	c.fillAndStroke();
	
	c.setShadow(false);
	
	if (h > 60)
	{
		c.rect(x, y + 50, 20, 20);
		c.stroke();
		c.rect(x, y + 80, 20, 20);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapeSysMLConstraintProperty.prototype.cst.CONS_PROP, mxShapeSysMLConstraintProperty);

//**********************************************************************************************************************************************************
//Call Behavior Action
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLCallBehaviorAction(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLCallBehaviorAction, mxShape);

mxShapeSysMLCallBehaviorAction.prototype.cst = {
		CALL_BEH_ACT : 'mxgraph.sysml.callBehAct'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLCallBehaviorAction.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.roundrect(x, y, w, h, 10, 10);
	c.fillAndStroke();
	
	if ((h > 30) && (w > 40))
	{
		c.setShadow(false);
		
		this.drawSymb(c, x + w - 30, y + h - 30, 20, 20);
	}
};

mxShapeSysMLCallBehaviorAction.prototype.drawSymb = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(x + w * 0.5, y);
	c.lineTo(x + w * 0.5, y + h);
	c.moveTo(x, y + h);
	c.lineTo(x, y + h * 0.5);
	c.lineTo(x + w, y + h * 0.5);
	c.lineTo(x + w, y + h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeSysMLCallBehaviorAction.prototype.cst.CALL_BEH_ACT, mxShapeSysMLCallBehaviorAction);

mxShapeSysMLCallBehaviorAction.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 2.9, 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false, null, -2.9, 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false, null, -2.9, -2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false, null, 2.9, -2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Accept Event Action
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLAcceptEventAction(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLAcceptEventAction, mxShape);

mxShapeSysMLAcceptEventAction.prototype.cst = {
		ACC_EVENT : 'mxgraph.sysml.accEvent'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLAcceptEventAction.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(x, y);
	c.lineTo(x + w, y);
	c.lineTo(x + w, y + h);
	c.lineTo(x, y + h);
	c.lineTo(x + h * 0.3, y + h * 0.5);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLAcceptEventAction.prototype.cst.ACC_EVENT, mxShapeSysMLAcceptEventAction);

mxShapeSysMLAcceptEventAction.prototype.getConstraints = function(style, w, h)
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
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false, null,  h * 0.3, 0));

	return (constr);
};

//**********************************************************************************************************************************************************
//Time Event
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLTimeEvent(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLTimeEvent, mxShape);

mxShapeSysMLTimeEvent.prototype.cst = {
		TIME_EVENT : 'mxgraph.sysml.timeEvent'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLTimeEvent.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(x, y);
	c.lineTo(x + w, y);
	c.lineTo(x, y + h);
	c.lineTo(x + w, y + h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLTimeEvent.prototype.cst.TIME_EVENT, mxShapeSysMLTimeEvent);

mxShapeSysMLTimeEvent.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0.5), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Send Signal Action
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLSendSignalAction(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLSendSignalAction, mxShape);

mxShapeSysMLSendSignalAction.prototype.cst = {
		SEND_SIG_ACT : 'mxgraph.sysml.sendSigAct'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLSendSignalAction.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(x, y);
	c.lineTo(x + w - h * 0.3, y);
	c.lineTo(x + w, y + h * 0.5);
	c.lineTo(x + w - h * 0.3, y + h);
	c.lineTo(x, y + h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLSendSignalAction.prototype.cst.SEND_SIG_ACT, mxShapeSysMLSendSignalAction);

mxShapeSysMLSendSignalAction.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false, null, -h * 0.3, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false, null, -h * 0.3, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Activity Final
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLActivityFinal(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLActivityFinal, mxShape);

mxShapeSysMLActivityFinal.prototype.cst = {
		ACT_FINAL : 'mxgraph.sysml.actFinal'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLActivityFinal.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.ellipse(x, y, w, h);
	c.fillAndStroke();
	
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setFillColor(strokeColor);
	
	c.ellipse(x + 5, y + 5, w - 10, h - 10);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLActivityFinal.prototype.cst.ACT_FINAL, mxShapeSysMLActivityFinal);

mxShapeSysMLActivityFinal.prototype.getConstraints = function(style, w, h)
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
//Activity Parameter Node
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLActivityParameterNode(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLActivityParameterNode, mxShape);

mxShapeSysMLActivityParameterNode.prototype.cst = {
		ACT_PARAM_NODE : 'mxgraph.sysml.actParamNode'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLActivityParameterNode.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	var minX = Math.max(w * 0.35, 70);
	var maxX = Math.min(w * 0.65, w - 10);
	c.begin();
	c.moveTo(minX, h);
	c.lineTo(10, h);
	c.lineTo(10, 0);
	c.lineTo(minX, 0);
	c.moveTo(maxX, h);
	c.lineTo(w - 10, h);
	c.lineTo(w - 10, 0);
	c.lineTo(maxX, 0);
	c.stroke();

	var xSize = 50;
	var ySize = 20;
	
	xSize = Math.min(xSize, w);
	
	if (xSize > ySize)
	{
		c.begin();
		c.moveTo(10, ySize);
		c.lineTo(xSize - ySize * 0.5, ySize);
		c.lineTo(xSize, ySize * 0.5);
		c.lineTo(xSize, 0);
		c.lineTo(10, 0);
		c.close();
		c.fillAndStroke();
	}
	
	c.rect(0, h * 0.35 - 10, 20, 20);
	c.fillAndStroke();
	c.rect(0, h * 0.65 - 10, 20, 20);
	c.fillAndStroke();
	c.rect(w - 20, h * 0.5 - 10, 20, 20);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLActivityParameterNode.prototype.cst.ACT_PARAM_NODE, mxShapeSysMLActivityParameterNode);

mxShapeSysMLActivityParameterNode.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.35), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.65), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Control Operator
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLControlOperator(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLControlOperator, mxShape);

mxShapeSysMLControlOperator.prototype.cst = {
		CONT_OPER : 'mxgraph.sysml.contOper'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLControlOperator.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeSysMLControlOperator.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeSysMLControlOperator.prototype.foreground = function(c, x, y, w, h)
{
	var xSize = 130;
	var ySize = 20;
	
	xSize = Math.min(xSize, w);
	
	if (xSize > ySize)
	{
		c.begin();
		c.moveTo(0, ySize);
		c.lineTo(xSize - ySize * 0.5, ySize);
		c.lineTo(xSize, ySize * 0.5);
		c.lineTo(xSize, 0);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapeSysMLControlOperator.prototype.cst.CONT_OPER, mxShapeSysMLControlOperator);

//**********************************************************************************************************************************************************
//Flow Final
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLFlowFinal(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLFlowFinal, mxShape);

mxShapeSysMLFlowFinal.prototype.cst = {
		FLOW_FINAL : 'mxgraph.sysml.flowFinal'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLFlowFinal.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();

	c.setShadow(false);
	
	c.begin();
	c.moveTo(w * 0.145, h * 0.145);
	c.lineTo(w * 0.855, h * 0.855);
	c.moveTo(w * 0.855, h * 0.145);
	c.lineTo(w * 0.145, h * 0.855);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeSysMLFlowFinal.prototype.cst.FLOW_FINAL, mxShapeSysMLFlowFinal);

mxShapeSysMLFlowFinal.prototype.getConstraints = function(style, w, h)
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
//Is Control
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLIsControl(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLIsControl, mxShape);

mxShapeSysMLIsControl.prototype.cst = {
		IS_CONTROL : 'mxgraph.sysml.isControl'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLIsControl.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.rect(0, h * 0.5 - 10, 10, 20);
	c.fillAndStroke();
	c.roundrect(10, 0, w - 20, h, 10, 10);
	c.fillAndStroke();
	c.rect(w - 10, h * 0.5 - 10, 10, 20);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLIsControl.prototype.cst.IS_CONTROL, mxShapeSysMLIsControl);

mxShapeSysMLIsControl.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Is Stream
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLIsStream(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLIsStream, mxShape);

mxShapeSysMLIsStream.prototype.cst = {
		IS_STREAM : 'mxgraph.sysml.isStream'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLIsStream.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');

	c.setFillColor(strokeColor);
	c.rect(0, h * 0.5 - 10, 10, 20);
	c.fillAndStroke();
	
	c.setFillColor(fillColor);
	c.roundrect(10, 0, w - 20, h, 10, 10);
	c.fillAndStroke();

	c.setFillColor(strokeColor);
	c.rect(w - 10, h * 0.5 - 10, 10, 20);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLIsStream.prototype.cst.IS_STREAM, mxShapeSysMLIsStream);

mxShapeSysMLIsStream.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Is Activity Stream
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLIsActStream(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLIsActStream, mxShape);

mxShapeSysMLIsActStream.prototype.cst = {
		IS_ACT_STREAM : 'mxgraph.sysml.isActStream'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLIsActStream.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.rect(0, 0, w - 10, h);
	c.fillAndStroke();

	var xSize = 40;
	var ySize = 20;
	
	xSize = Math.min(xSize, w);
	
	if (xSize > ySize)
	{
		c.begin();
		c.moveTo(0, ySize);
		c.lineTo(xSize - ySize * 0.5, ySize);
		c.lineTo(xSize, ySize * 0.5);
		c.lineTo(xSize, 0);
		c.lineTo(0, 0);
		c.close();
		c.fillAndStroke();
	}
	
	c.rect(w - 20, h * 0.5 - 10, 20, 20);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLIsActStream.prototype.cst.IS_ACT_STREAM, mxShapeSysMLIsActStream);

mxShapeSysMLIsActStream.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Parameter Set
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLParameterSet(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLParameterSet, mxShape);

mxShapeSysMLParameterSet.prototype.cst = {
		PARAM_SET : 'mxgraph.sysml.paramSet'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLParameterSet.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.rect(0, h * 0.5 - 28, 10, 56);
	c.fillAndStroke();
	c.roundrect(10, 0, w - 20, h, 10, 10);
	c.fillAndStroke();
	c.rect(w - 10, h * 0.5 - 28, 10, 56);
	c.fillAndStroke();

	c.setShadow(false);

	c.rect(4, h * 0.5 - 24, 6, 20);
	c.fillAndStroke();
	c.rect(4, h * 0.5 + 4, 6, 20);
	c.fillAndStroke();
	c.rect(w - 10, h * 0.5 - 24, 6, 20);
	c.fillAndStroke();
	c.rect(w - 10, h * 0.5 + 4, 6, 20);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLParameterSet.prototype.cst.PARAM_SET, mxShapeSysMLParameterSet);

mxShapeSysMLParameterSet.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false, null, 0, -14));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false, null, 0, 14));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false, null, 0, -14));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false, null, 0, 14));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Is Parameter Activity Set
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLParameterActivitySet(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLParameterActivitySet, mxShape);

mxShapeSysMLParameterActivitySet.prototype.cst = {
		PARAM_ACT_SET : 'mxgraph.sysml.paramActSet'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLParameterActivitySet.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.rect(10, 0, w - 20, h);
	c.fillAndStroke();

	var xSize = 50;
	var ySize = 20;
	
	xSize = Math.min(xSize, w);
	
	if (xSize > ySize)
	{
		c.begin();
		c.moveTo(10, ySize);
		c.lineTo(xSize - ySize * 0.5, ySize);
		c.lineTo(xSize, ySize * 0.5);
		c.lineTo(xSize, 0);
		c.lineTo(10, 0);
		c.close();
		c.fillAndStroke();
	}
	
	c.setShadow(false);
	
	if (h > 70)
	{
		c.rect(0, h * 0.5 - 28, 15, 56);
		c.fillAndStroke();
		c.rect(4, h * 0.5 - 24, 15, 20);
		c.fillAndStroke();
		c.rect(4, h * 0.5 + 4, 15, 20);
		c.fillAndStroke();
	
		c.rect(w - 15, h * 0.5 - 28, 15, 56);
		c.fillAndStroke();
		c.rect(w - 19, h * 0.5 - 24, 15, 20);
		c.fillAndStroke();
		c.rect(w - 19, h * 0.5 + 4, 15, 20);
		c.fillAndStroke();
	}
};

mxCellRenderer.registerShape(mxShapeSysMLParameterActivitySet.prototype.cst.PARAM_ACT_SET, mxShapeSysMLParameterActivitySet);

mxShapeSysMLParameterActivitySet.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false, null, 0, -14));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false, null, 0, 14));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false, null, 0, -14));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false, null, 0, 14));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Probability
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLProbability(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLProbability, mxShape);

mxShapeSysMLProbability.prototype.cst = {
		PROBABILITY : 'mxgraph.sysml.probability'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLProbability.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.roundrect(0, 0, w - 10, h, 10, 10);
	c.fillAndStroke();
	c.rect(w - 10, h * 0.25 - 28, 10, 56);
	c.fillAndStroke();
	c.rect(w - 10, h * 0.75 - 28, 10, 56);
	c.fillAndStroke();

	c.setShadow(false);

	c.rect(w - 10, h * 0.25 - 24, 6, 20);
	c.fillAndStroke();
	c.rect(w - 10, h * 0.25 + 4, 6, 20);
	c.fillAndStroke();
	c.rect(w - 10, h * 0.75 - 24, 6, 20);
	c.fillAndStroke();
	c.rect(w - 10, h * 0.75 + 4, 6, 20);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLProbability.prototype.cst.PROBABILITY, mxShapeSysMLProbability);

mxShapeSysMLProbability.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false, null, 0, -14));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false, null, 0, 14));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false, null, 0, -14));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false, null, 0, 14));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false, null, -5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false, null, -5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false, null, -5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false, null, -5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false, null, -5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false, null, -5, 0));

	return (constr);
};

//**********************************************************************************************************************************************************
//Is Activity Stream
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLActivityProbability(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLActivityProbability, mxShape);

mxShapeSysMLActivityProbability.prototype.cst = {
		ACT_PROB : 'mxgraph.sysml.actProb'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLActivityProbability.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.rect(0, 0, w - 10, h);
	c.fillAndStroke();

	var xSize = 40;
	var ySize = 20;
	
	xSize = Math.min(xSize, w);
	
	if (xSize > ySize)
	{
		c.begin();
		c.moveTo(0, ySize);
		c.lineTo(xSize - ySize * 0.5, ySize);
		c.lineTo(xSize, ySize * 0.5);
		c.lineTo(xSize, 0);
		c.lineTo(0, 0);
		c.close();
		c.fillAndStroke();
	}
	
	c.setShadow(false);
	
	if (h > 70)
	{
		c.rect(w - 15, h * 0.25 - 28, 15, 56);
		c.fillAndStroke();
		c.rect(w - 19, h * 0.25 - 24, 15, 20);
		c.fillAndStroke();
		c.rect(w - 19, h * 0.25 + 4, 15, 20);
		c.fillAndStroke();

		c.rect(w - 15, h * 0.75 - 28, 15, 56);
		c.fillAndStroke();
		c.rect(w - 19, h * 0.75 - 24, 15, 20);
		c.fillAndStroke();
		c.rect(w - 19, h * 0.75 + 4, 15, 20);
		c.fillAndStroke();
	}
};

mxCellRenderer.registerShape(mxShapeSysMLActivityProbability.prototype.cst.ACT_PROB, mxShapeSysMLActivityProbability);

mxShapeSysMLActivityProbability.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false, null, 0, -14));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false, null, 0, 14));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false, null, 0, -14));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false, null, 0, 14));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false, null, -5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false, null, -5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false, null, -5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false, null, -5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false, null, -5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false, null, -5, 0));

	return (constr);
};

//**********************************************************************************************************************************************************
//Object Flow Right
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLObjectFlowRight(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLObjectFlowRight, mxShape);

mxShapeSysMLObjectFlowRight.prototype.cst = {
		OBJ_FLOW_R : 'mxgraph.sysml.objFlowR'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLObjectFlowRight.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.roundrect(0, 0, w - 10, h, 10, 10);
	c.fillAndStroke();
	c.rect(w - 10, h * 0.5 - 10, 10, 20);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLObjectFlowRight.prototype.cst.OBJ_FLOW_R, mxShapeSysMLObjectFlowRight);

mxShapeSysMLObjectFlowRight.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false, null, -5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false, null, -5, 0));

	return (constr);
};

//**********************************************************************************************************************************************************
//Object Flow Left
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLObjectFlowLeft(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLObjectFlowLeft, mxShape);

mxShapeSysMLObjectFlowLeft.prototype.cst = {
		OBJ_FLOW_L : 'mxgraph.sysml.objFlowL'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLObjectFlowLeft.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.rect(0, h * 0.5 - 10, 10, 20);
	c.fillAndStroke();
	c.roundrect(10, 0, w - 10, h, 10, 10);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLObjectFlowLeft.prototype.cst.OBJ_FLOW_L, mxShapeSysMLObjectFlowLeft);

mxShapeSysMLObjectFlowLeft.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false, null, 5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false, null, 5, 0));

	return (constr);
};

//**********************************************************************************************************************************************************
//Activity Partition
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLActivityPartition(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLActivityPartition, mxShape);

mxShapeSysMLActivityPartition.prototype.cst = {
		ACT_PART : 'mxgraph.sysml.actPart'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLActivityPartition.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(0, 0);
	c.lineTo(0, h);
	c.moveTo(w, 0);
	c.lineTo(w, h);
	c.stroke();
	
};

mxCellRenderer.registerShape(mxShapeSysMLActivityPartition.prototype.cst.ACT_PART, mxShapeSysMLActivityPartition);

//**********************************************************************************************************************************************************
//Continuation
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLContinuation(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLContinuation, mxShape);

mxShapeSysMLContinuation.prototype.cst = {
		CONT : 'mxgraph.sysml.cont'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLContinuation.prototype.paintVertexShape = function(c, x, y, w, h)
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

mxCellRenderer.registerShape(mxShapeSysMLContinuation.prototype.cst.CONT, mxShapeSysMLContinuation);

mxShapeSysMLContinuation.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	
	if (w > h)
	{
		var r = h * 0.5;

		if (w > 2 * h)
		{
			constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
			constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
			constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
			constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
		}
	}
	else
	{
		var r = w * 0.5;
		
		if (h > 2 * w)
		{
			constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));
			constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
			constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false));
			constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false));
		}
	}

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, r * 0.29, r * 0.29));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - r * 0.29, r * 0.29));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, r * 0.29, h - r * 0.29));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - r * 0.29, h - r * 0.29));

	return (constr);
};

//**********************************************************************************************************************************************************
//Coregion
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLCoregion(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLCoregion, mxShape);

mxShapeSysMLCoregion.prototype.cst = {
		COREGION : 'mxgraph.sysml.coregion'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLCoregion.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var brack = 10;
	
	brack = Math.min(brack, h);
	
	c.begin();
	c.moveTo(0, brack);
	c.lineTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, brack);
	c.moveTo(0, h - brack);
	c.lineTo(0, h);
	c.lineTo(w, h);
	c.lineTo(w, h - brack);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeSysMLCoregion.prototype.cst.COREGION, mxShapeSysMLCoregion);

//**********************************************************************************************************************************************************
//X marker
//**********************************************************************************************************************************************************
mxMarker.addMarker('sysMLx', function(c, shape, type, pe, unitX, unitY, size, source, sw, filled)
{
	var nx = unitX * (size + sw + 1);
	var ny = unitY * (size + sw + 1);

	return function()
	{
		c.begin();
		c.moveTo(pe.x - nx / 2 - ny / 2, pe.y - ny / 2 + nx / 2);
		c.lineTo(pe.x + nx / 2 + ny / 2, pe.y + ny / 2 - nx / 2);

		c.moveTo(pe.x + nx / 2 - ny / 2, pe.y + ny / 2 + nx / 2);
		c.lineTo(pe.x - nx / 2 + ny / 2, pe.y - ny / 2 - nx / 2);
		c.stroke();
	};
});

//**********************************************************************************************************************************************************
//Dimension
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLDimension(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLDimension, mxShape);

mxShapeSysMLDimension.prototype.cst = {
		DIMENSION : 'mxgraph.sysml.dimension'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLDimension.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxShapeSysMLDimension.prototype.background = function(c, x, y, w, h)
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

mxCellRenderer.registerShape(mxShapeSysMLDimension.prototype.cst.DIMENSION, mxShapeSysMLDimension);

//**********************************************************************************************************************************************************
//Lost marker
//**********************************************************************************************************************************************************
mxMarker.addMarker('sysMLLost', function(c, shape, type, pe, unitX, unitY, size, source, sw, filled)
{
	var nx = unitX * (size + sw + 1);
	var ny = unitY * (size + sw + 1);
	var a = size / 2;

	return function()
	{
		c.begin();
		c.moveTo(pe.x - 1.5 * nx - ny / 2, pe.y - 1.5 * ny + nx / 2);
		c.lineTo(pe.x - nx / 2, pe.y - ny / 2);
		c.lineTo(pe.x - 1.5 * nx + ny / 2, pe.y - 1.5 * ny - nx / 2);
		c.stroke();

		c.ellipse(pe.x - 0.5 * nx - a, pe.y - 0.5 * ny - a, 2 * a, 2 * a);

		var strokeColor = mxUtils.getValue(shape.style, mxConstants.STYLE_STROKECOLOR, '#000000');
		c.setFillColor(strokeColor);
		c.fillAndStroke();
	};
});

//**********************************************************************************************************************************************************
//Found marker
//**********************************************************************************************************************************************************
mxMarker.addMarker('sysMLFound', function(c, shape, type, pe, unitX, unitY, size, source, sw, filled)
{
	var nx = unitX * (size + sw + 1);
	var ny = unitY * (size + sw + 1);
	var a = size / 2;

	return function()
	{
		c.ellipse(pe.x - 0.5 * nx - a, pe.y - 0.5 * ny - a, 2 * a, 2 * a);

		var strokeColor = mxUtils.getValue(shape.style, mxConstants.STYLE_STROKECOLOR, '#000000');
		c.setFillColor(strokeColor);
		c.fillAndStroke();
	};
});

//**********************************************************************************************************************************************************
//Composite State
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLCompositeState(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLCompositeState, mxShape);

mxShapeSysMLCompositeState.prototype.cst = {
		COMP_STATE : 'mxgraph.sysml.compState'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLCompositeState.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxShapeSysMLCompositeState.prototype.background = function(c, x, y, w, h)
{
	var tabH = 20;
	var tabW = 110;
	c.roundrect(0, tabH, w, h - tabH, 10, 10);
	c.fillAndStroke();
	c.rect(15, 0, tabW, tabH);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLCompositeState.prototype.cst.COMP_STATE, mxShapeSysMLCompositeState);

mxShapeSysMLCompositeState.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 2.9, 22.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - 2.9, 22.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 2.9, h - 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - 2.9, h - 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, (h - 20) * 0.25 + 20));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, (h - 20) * 0.5 + 20));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, (h - 20) * 0.75 + 20));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false, null, 0, (h - 20) * 0.25 + 20));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false, null, 0, (h - 20) * 0.5 + 20));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false, null, 0, (h - 20) * 0.75 + 20));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 15, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 70, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 125, 0));

	if (w * 0.75 > 125)
	{
		constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false, null, 0, 20));
		
		if (w * 0.5 > 125)
		{
			constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false, null, 0, 20));

			if (w * 0.25 > 125)
			{
				constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false, null, 0, 20));
			}
		}
	}
	
	return (constr);
};

//**********************************************************************************************************************************************************
//Region
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLRegion(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLRegion, mxShape);

mxShapeSysMLRegion.prototype.cst = {
		REGION : 'mxgraph.sysml.region'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLRegion.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var tabH = 20;
	var tabW = 50;

	c.translate(x, y);
	this.background(c, x, y, w, h, tabH, tabW);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, tabH, tabW);
};

mxShapeSysMLRegion.prototype.background = function(c, x, y, w, h, tabH, tabW)
{
	var strokeW = parseInt(mxUtils.getValue(this.style, mxConstants.STYLE_STROKEWIDTH, '1'));
	c.roundrect(0, tabH, w, h - tabH, 10, 10);
	c.fillAndStroke();
	
	c.setStrokeWidth(strokeW * 2);
	c.rect(15, 0, tabW, tabH);
	c.fillAndStroke();
	c.setStrokeWidth(strokeW);
};

mxShapeSysMLRegion.prototype.foreground = function(c, x, y, w, h, tabH, tabW)
{
	c.setDashed(true);
	c.begin();
	c.moveTo(w * 0.5, tabH);
	c.lineTo(w * 0.5, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeSysMLRegion.prototype.cst.REGION, mxShapeSysMLRegion);

mxShapeSysMLRegion.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 2.9, 22.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - 2.9, 22.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 2.9, h - 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - 2.9, h - 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, (h - 20) * 0.25 + 20));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, (h - 20) * 0.5 + 20));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, (h - 20) * 0.75 + 20));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false, null, 0, (h - 20) * 0.25 + 20));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false, null, 0, (h - 20) * 0.5 + 20));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false, null, 0, (h - 20) * 0.75 + 20));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 15, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 40, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 65, 0));

	if (w * 0.75 > 65)
	{
		constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false, null, 0, 20));
		
		if (w * 0.5 > 65)
		{
			constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false, null, 0, 20));

			if (w * 0.25 > 65)
			{
				constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false, null, 0, 20));
			}
		}
	}
	
	return (constr);
};

//**********************************************************************************************************************************************************
//Simple State
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLSimpleState(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLSimpleState, mxShape);

mxShapeSysMLSimpleState.prototype.cst = {
		SIMPLE_STATE : 'mxgraph.sysml.simpleState'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLSimpleState.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
//	this.foreground(c, x, y, w, h);
};

mxShapeSysMLSimpleState.prototype.background = function(c, x, y, w, h)
{
	var strokeW = parseInt(mxUtils.getValue(this.style, mxConstants.STYLE_STROKEWIDTH, '1'));
	c.roundrect(0, 0, w, h, 10, 10);
	c.fillAndStroke();
};

mxShapeSysMLSimpleState.prototype.foreground = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, 20);
	c.lineTo(w, 20);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeSysMLSimpleState.prototype.cst.SIMPLE_STATE, mxShapeSysMLSimpleState);

mxShapeSysMLSimpleState.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 2.9, 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - 2.9, 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 2.9, h - 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - 2.9, h - 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	
	return (constr);
};

//**********************************************************************************************************************************************************
//State Machine
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLStateMachine(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLStateMachine, mxShape);

mxShapeSysMLStateMachine.prototype.cst = {
		STATE_MACHINE : 'mxgraph.sysml.stateMachine'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLStateMachine.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeSysMLStateMachine.prototype.background = function(c, x, y, w, h)
{
	c.roundrect(0, 0, w - 10, h, 10, 10);
	c.fillAndStroke();
};

mxShapeSysMLStateMachine.prototype.foreground = function(c, x, y, w, h)
{
	var strokeC = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setFillColor(strokeC);

	c.ellipse(w - 20, h * 0.5 - 10, 20, 20);
	c.stroke();
	
	c.ellipse(w - 17, h * 0.5 - 7, 14, 14);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLStateMachine.prototype.cst.STATE_MACHINE, mxShapeSysMLStateMachine);

mxShapeSysMLStateMachine.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 2.9, 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - 12.9, 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 2.9, h - 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - 12.9, h - 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false, null, -10, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false, null, -10, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	
	return (constr);
};

//**********************************************************************************************************************************************************
// X
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLX(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLX, mxShape);

mxShapeSysMLX.prototype.cst = {
		X : 'mxgraph.sysml.x'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLX.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, h);
	c.moveTo(0, h);
	c.lineTo(w, 0);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLX.prototype.cst.X, mxShapeSysMLX);

mxShapeSysMLX.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false));
	
	return (constr);
};

//**********************************************************************************************************************************************************
//Submachine State
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLSubmachineState(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLSubmachineState, mxShape);

mxShapeSysMLSubmachineState.prototype.cst = {
		SUBMACHINE_STATE : 'mxgraph.sysml.submState'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLSubmachineState.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeSysMLSubmachineState.prototype.background = function(c, x, y, w, h)
{
	c.roundrect(0, 0, w - 10, h, 10, 10);
	c.fillAndStroke();
};

mxShapeSysMLSubmachineState.prototype.foreground = function(c, x, y, w, h)
{
	var strokeC = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setFillColor(strokeC);

	c.ellipse(w - 20, h * 0.5 - 10, 20, 20);
	c.stroke();
	
	c.ellipse(w - 17, h * 0.5 - 7, 14, 14);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeSysMLSubmachineState.prototype.cst.SUBMACHINE_STATE, mxShapeSysMLSubmachineState);

mxShapeSysMLSubmachineState.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 2.9, 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - 12.9, 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 2.9, h - 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - 12.9, h - 2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false, null, -10, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false, null, -10, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	
	return (constr);
};

//**********************************************************************************************************************************************************
//Use Case with Extension Points
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeSysMLUseCaseExtensionPoints(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeSysMLUseCaseExtensionPoints, mxShape);

mxShapeSysMLUseCaseExtensionPoints.prototype.cst = {
		USE_CASE_EXT_PT : 'mxgraph.sysml.useCaseExtPt'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeSysMLUseCaseExtensionPoints.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeSysMLUseCaseExtensionPoints.prototype.background = function(c, x, y, w, h)
{
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeSysMLUseCaseExtensionPoints.prototype.foreground = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w * 0.02, h * 0.35);
	c.lineTo(w * 0.98, h * 0.35);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeSysMLUseCaseExtensionPoints.prototype.cst.USE_CASE_EXT_PT, mxShapeSysMLUseCaseExtensionPoints);

mxShapeSysMLUseCaseExtensionPoints.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.145, 0.145), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.145, 0.855), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.855, 0.855), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.855, 0.145), false));
	
	return (constr);
};
