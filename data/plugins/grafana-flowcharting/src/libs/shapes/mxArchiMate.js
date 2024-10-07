/**
 * $Id: mxArchiMate.js,v 1.0 2014/03/17 07:05:39 mate Exp $
 * Copyright (c) 2006-2014, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Location
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMateLocation(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMateLocation, mxShape);

mxArchiMateLocation.prototype.cst = {
		LOCATION : 'mxgraph.archimate.location'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMateLocation.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	c.translate(w - 20, 5);
	this.foreground(c, w - 20, 5, 15, 15);
};

mxArchiMateLocation.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxArchiMateLocation.prototype.foreground = function(c, x, y, w, h)
{
	c.setDashed(false);
	
	c.translate(3 ,0);
	w = w - 6;
	c.begin();
	c.moveTo(w * 0.5, h);
	c.arcTo(w * 0.1775, h * 0.3, 0, 0, 0, w * 0.345, h * 0.7);
	c.arcTo(w * 0.538, h * 0.364, 0, 0, 1, w * 0.5, 0);
	c.arcTo(w * 0.538, h * 0.364, 0, 0, 1, w * 0.655, h * 0.7);
	c.arcTo(w * 0.1775, h * 0.3, 0, 0, 0, w * 0.5, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxArchiMateLocation.prototype.cst.LOCATION, mxArchiMateLocation);

mxArchiMateLocation.prototype.getConstraints = function(style, w, h)
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
//Business
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMateBusiness(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMateBusiness, mxShape);

mxArchiMateBusiness.prototype.cst = {
		BUSINESS : 'mxgraph.archimate.business',
		TYPE : 'busType',
		PROCESS : 'process',
		FUNCTION : 'function',
		INTERACTION : 'interaction',
		EVENT : 'event',
		SERVICE : 'service'
};

mxArchiMateBusiness.prototype.customProperties = [
	{name: 'busType', dispName: 'Business Type', type: 'enum', 
		enumList: [{val: 'process', dispName: 'Process'}, 
				   {val: 'function', dispName: 'Function'}, 
				   {val: 'interaction', dispName: 'Interaction'}, 
				   {val: 'event', dispName: 'Event'}, 
				   {val: 'service', dispName: 'Service'}]
	}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMateBusiness.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	c.translate(w - 20, 5);
	this.foreground(c, w - 20, 5, 15, 15);
};

mxArchiMateBusiness.prototype.background = function(c, x, y, w, h)
{
	c.roundrect(0, 0, w, h, 10, 10);
	c.fillAndStroke();
};

mxArchiMateBusiness.prototype.foreground = function(c, x, y, w, h)
{
	var type = mxUtils.getValue(this.style, mxArchiMateBusiness.prototype.cst.TYPE, mxArchiMateBusiness.prototype.cst.PROCESS);
	
	c.setDashed(false);
	
	if (type === mxArchiMateBusiness.prototype.cst.PROCESS)
	{
		c.translate(0, 2);
		h = h - 4;
	
		c.begin();
		c.moveTo(0, h * 0.15);
		c.lineTo(w * 0.65, h * 0.15);
		c.lineTo(w * 0.65, 0);
		c.lineTo(w, h * 0.5);
		c.lineTo(w * 0.65, h);
		c.lineTo(w * 0.65, h * 0.85);
		c.lineTo(0, h * 0.85);
		c.close();
		c.stroke();
	}
	else if (type === mxArchiMateBusiness.prototype.cst.FUNCTION)
	{
		c.translate(2, 0);
		w = w - 4;
		
		c.begin();
		c.moveTo(0, h * 0.15);
		c.lineTo(w * 0.5, 0);
		c.lineTo(w, h * 0.15);
		c.lineTo(w, h);
		c.lineTo(w * 0.5, h * 0.85);
		c.lineTo(0, h);
		c.close();
		c.stroke();
	}
	else if (type === mxArchiMateBusiness.prototype.cst.INTERACTION)
	{
		c.begin();
		c.moveTo(w * 0.55, 0);
		c.arcTo(w * 0.45, h * 0.5, 0, 0, 1, w * 0.55, h);
		c.close();
		c.moveTo(w * 0.45, 0);
		c.arcTo(w * 0.45, h * 0.5, 0, 0, 0, w * 0.45, h);
		c.close();
		c.stroke();
	}
	else if (type === mxArchiMateBusiness.prototype.cst.EVENT)
	{
		c.translate(0, 3);
		h = h - 6;
		
		c.begin();
		c.moveTo(w - h * 0.5, 0);
		c.arcTo(h * 0.5, h * 0.5, 0, 0, 1, w - h * 0.5, h);
		c.lineTo(0, h);
		c.arcTo(h * 0.5, h * 0.5, 0, 0, 0, 0, 0);
		c.close();
		c.stroke();
	}
	else if (type === mxArchiMateBusiness.prototype.cst.SERVICE)
	{
		c.translate(0, 3);
		h = h - 6;
		
		c.begin();
		c.moveTo(w - h * 0.5, 0);
		c.arcTo(h * 0.5, h * 0.5, 0, 0, 1, w - h * 0.5, h);
		c.lineTo(0, h);
		c.arcTo(h * 0.5, h * 0.5, 0, 0, 1, 0, 0);
		c.close();
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxArchiMateBusiness.prototype.cst.BUSINESS, mxArchiMateBusiness);

mxArchiMateBusiness.prototype.getConstraints = function(style, w, h)
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
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false, null, 2.9, -2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Business Object
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMateBusinessObject(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMateBusinessObject, mxShape);

mxArchiMateBusinessObject.prototype.cst = {
		BUSINESS_OBJECT : 'mxgraph.archimate.businessObject'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMateBusinessObject.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h);
};

mxArchiMateBusinessObject.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxArchiMateBusinessObject.prototype.foreground = function(c, x, y, w, h)
{
	if (h >= 15)
	{
		c.begin();
		c.moveTo(0, 15);
		c.lineTo(w, 15);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxArchiMateBusinessObject.prototype.cst.BUSINESS_OBJECT, mxArchiMateBusinessObject);

mxArchiMateBusinessObject.prototype.getConstraints = function(style, w, h)
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
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false, null, 2.9, -2.9));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Representation
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMateRepresentation(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMateRepresentation, mxShape);

mxArchiMateRepresentation.prototype.cst = {
		REPRESENTATION : 'mxgraph.archimate.representation'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMateRepresentation.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
};

mxArchiMateRepresentation.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h * 0.85);
	c.arcTo(w * 0.35, h * 0.35, 0, 0, 0, w * 0.5, h * 0.85);
	c.arcTo(w * 0.35, h * 0.35, 0, 0, 1, 0, h * 0.85);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMateRepresentation.prototype.cst.REPRESENTATION, mxArchiMateRepresentation);

mxArchiMateRepresentation.prototype.getConstraints = function(style, w, h)
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
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.85), false, null));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0.745), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0.85), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0.955), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.85), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Product
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMateProduct(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMateProduct, mxShape);

mxArchiMateProduct.prototype.cst = {
		PRODUCT : 'mxgraph.archimate.product'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMateProduct.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h);
};

mxArchiMateProduct.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxArchiMateProduct.prototype.foreground = function(c, x, y, w, h)
{
	if (h >= 15)
	{
		c.begin();
		c.moveTo(0, 15);
		c.lineTo(w * 0.6, 15);
		c.lineTo(w * 0.6, 0);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxArchiMateProduct.prototype.cst.PRODUCT, mxArchiMateProduct);

//**********************************************************************************************************************************************************
//Application
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMateApplication(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMateApplication, mxShape);

mxArchiMateApplication.prototype.cst = {
		APPLICATION : 'mxgraph.archimate.application',
		TYPE : 'appType',
		COMPONENT : 'comp',
		INTERFACE : 'interface',
		INTERFACE2 : 'interface2',
		FUNCTION : 'function',
		INTERACTION : 'interaction',
		SERVICE : 'service',
		NODE : 'node',
		NETWORK : 'network',
		COMM_PATH : 'commPath',
		SYS_SW : 'sysSw',
		ARTIFACT : 'artifact',
		ACTOR : 'actor',
		ROLE : 'role',
		COLLABORATION : 'collab'
};

mxArchiMateApplication.prototype.customProperties = [
	{name: 'appType', dispName: 'App Type', type: 'enum', 
		enumList: [{val: 'comp', dispName: 'Component'}, 
				   {val: 'interface', dispName: 'Interface'}, 
				   {val: 'interface2', dispName: 'Interface2'}, 
				   {val: 'function', dispName: 'Function'}, 
				   {val: 'interaction', dispName: 'Interaction'}, 
				   {val: 'service', dispName: 'Service'}, 
				   {val: 'node', dispName: 'Node'}, 
				   {val: 'network', dispName: 'Network'}, 
				   {val: 'commPath', dispName: 'Comm Path'}, 
				   {val: 'artifact', dispName: 'Artifact'}, 
				   {val: 'sysSw', dispName: 'System Sw'}, 
				   {val: 'path', dispName: 'Path'},
				   {val: 'actor', dispName: 'Actor'}, 
				   {val: 'role', dispName: 'Role'}, 
				   {val: 'collab', dispName: 'Collaboration'}]
	}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMateApplication.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	c.translate(w - 20, 5);
	this.foreground(c, w - 20, 5, 15, 15);
};

mxArchiMateApplication.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxArchiMateApplication.prototype.foreground = function(c, x, y, w, h)
{
	var type = mxUtils.getValue(this.style, mxArchiMateApplication.prototype.cst.TYPE, mxArchiMateApplication.prototype.cst.COMPONENT);
	
	c.setDashed(false);
	
	if (type === mxArchiMateApplication.prototype.cst.COMPONENT)
	{
		c.translate(1, 0);
		w = w - 2;

		c.rect(w * 0.25, 0, w * 0.75, h);
		c.stroke();
		
		c.rect(0, h * 0.25, w * 0.5, h * 0.15);
		c.fillAndStroke();
		
		c.rect(0, h * 0.6, w * 0.5, h * 0.15);
		c.fillAndStroke();
	}
	else if (type === mxArchiMateApplication.prototype.cst.COLLABORATION)
	{
		c.translate(0, 3);
		h = h - 6;
		
		c.ellipse(0, 0, w * 0.6, h);
		c.stroke();
		c.ellipse(w * 0.4, 0, w * 0.6, h);
		c.fillAndStroke();
	}
	else if (type === mxArchiMateApplication.prototype.cst.INTERFACE)
	{
		c.translate(0, 4);
		h = h - 8;
		
		c.ellipse(w * 0.5, 0, w * 0.5, h);
		c.stroke();
		
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w * 0.5, h * 0.5);
		c.stroke();
	}
	else if (type === mxArchiMateApplication.prototype.cst.INTERFACE2)
	{
		c.translate(0, 1);
		h = h - 2;
		
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w * 0.6, h * 0.5);
		c.moveTo(w, 0);
		c.arcTo(w * 0.4, h * 0.5, 0, 0, 0, w, h);
		c.stroke();
	}
	else if (type === mxArchiMateApplication.prototype.cst.FUNCTION)
	{
		c.begin();
		c.moveTo(w * 0.5, 0);
		c.lineTo(w, h * 0.2);
		c.lineTo(w, h);
		c.lineTo(w * 0.5, h * 0.8);
		c.lineTo(0, h);
		c.lineTo(0, h * 0.2);
		c.close();
		c.stroke();
	}
	else if (type === mxArchiMateApplication.prototype.cst.INTERACTION)
	{
		c.begin();
		c.moveTo(w * 0.55, 0);
		c.arcTo(w * 0.45, h * 0.5, 0, 0, 1, w * 0.55, h);
		c.close();
		c.moveTo(w * 0.45, 0);
		c.arcTo(w * 0.45, h * 0.5, 0, 0, 0, w * 0.45, h);
		c.close();
		c.stroke();
	}
	else if (type === mxArchiMateApplication.prototype.cst.SERVICE)
	{
		c.translate(0, 3);
		h = h - 6;
		
		c.begin();
		c.moveTo(w - h * 0.5, 0);
		c.arcTo(h * 0.5, h * 0.5, 0, 0, 1, w - h * 0.5, h);
		c.lineTo(0, h);
		c.arcTo(h * 0.5, h * 0.5, 0, 0, 1, 0, 0);
		c.close();
		c.stroke();
	}
	else if (type === mxArchiMateApplication.prototype.cst.NODE)
	{
		c.begin();
		c.moveTo(0, h * 0.25);
		c.lineTo(w * 0.25, 0);
		c.lineTo(w, 0);
		c.lineTo(w, h * 0.75);
		c.lineTo(w * 0.75, h);
		c.lineTo(0, h);
		c.close();
		c.moveTo(0, h * 0.25);
		c.lineTo(w * 0.75, h * 0.25);
		c.lineTo(w * 0.75, h);
		c.moveTo(w, 0);
		c.lineTo(w * 0.75, h * 0.25);
		c.stroke();
	}
	else if (type === mxArchiMateApplication.prototype.cst.NETWORK)
	{
		c.translate(0, 2);
		h = h - 4;
		
		c.begin();
		c.moveTo(w * 0.4, h * 0.2);
		c.lineTo(w * 0.85, h * 0.2);
		c.lineTo(w * 0.6, h * 0.8);
		c.lineTo(w * 0.15, h * 0.8);
		c.close();
		c.stroke();
		
		var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
		c.setFillColor(strokeColor);
		
		c.ellipse(w * 0.25, 0, w * 0.3, h * 0.4);
		c.fill();
		
		c.ellipse(w * 0.7, 0, w * 0.3, h * 0.4);
		c.fill();
		
		c.ellipse(0, h * 0.6, w * 0.3, h * 0.4);
		c.fill();
		
		c.ellipse(w * 0.45, h * 0.6, w * 0.3, h * 0.4);
		c.fill();
	}
	else if (type === mxArchiMateApplication.prototype.cst.COMM_PATH)
	{
		c.translate(0, 5);
		h = h - 10;
		
		c.begin();
		c.moveTo(w * 0.1, 0);
		c.lineTo(0, h * 0.5);
		c.lineTo(w * 0.1, h);
		c.moveTo(w * 0.9, 0);
		c.lineTo(w, h * 0.5);
		c.lineTo(w * 0.9, h);
		c.stroke();
		
		c.setDashed(true);
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
	else if (type === mxArchiMateApplication.prototype.cst.SYS_SW)
	{
		c.ellipse(w * 0.3, 0, w * 0.7, h * 0.7);
		c.stroke();
		
		c.ellipse(0, h * 0.02, w * 0.98, h * 0.98);
		c.fillAndStroke();
	}
	else if (type === mxArchiMateApplication.prototype.cst.ARTIFACT)
	{
		c.translate(2, 0);
		w = w - 4;

		c.begin();
		c.moveTo(0, 0);
		c.lineTo(w * 0.7, 0);
		c.lineTo(w, h * 0.22);
		c.lineTo(w, h);
		c.lineTo(0, h);
		c.close();
		c.moveTo(w * 0.7, 0);
		c.lineTo(w * 0.7, h * 0.22);
		c.lineTo(w, h * 0.22);
		c.stroke();
	}
	else if (type === mxArchiMateApplication.prototype.cst.ACTOR)
	{
		c.translate(3, 0);
		w = w - 6;
		c.ellipse(w * 0.2, 0, w * 0.6, h * 0.3);
		c.stroke();
		
		c.begin();
		c.moveTo(w * 0.5, h * 0.3);
		c.lineTo(w * 0.5, h * 0.75);
		c.moveTo(0, h * 0.45);
		c.lineTo(w, h * 0.45);
		c.moveTo(0, h);
		c.lineTo(w * 0.5, h * 0.75);
		c.lineTo(w, h);
		c.stroke();
	}
	if (type === mxArchiMateApplication.prototype.cst.ROLE)
	{
		c.translate(0, 4);
		h = h - 8;

		c.begin();
		c.moveTo(w * 0.8, 0);
		c.lineTo(w * 0.2, 0);
		c.arcTo(w * 0.2, h * 0.5, 0, 0, 0, w * 0.2, h);
		c.lineTo(w * 0.8, h);
		c.stroke();
		
		c.ellipse(w * 0.6, 0, w * 0.4, h);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxArchiMateApplication.prototype.cst.APPLICATION, mxArchiMateApplication);

mxArchiMateApplication.prototype.getConstraints = function(style, w, h)
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
//Tech
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMateTech(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMateTech, mxShape);

mxArchiMateTech.prototype.cst = {
		TECH : 'mxgraph.archimate.tech',
		TYPE : 'techType',
		DEVICE : 'device',
		PLATEAU : 'plateau'
};

mxArchiMateTech.prototype.customProperties = [
	{name: 'techType', dispName: 'Tech Type', type: 'enum', 
		enumList: [{val: 'device', dispName: 'Device'}, 
				   {val: 'plateau', dispName: 'Plateau'}]
	}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMateTech.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	c.translate(w - 30, 15);
	this.foreground(c, w - 30, 15, 15, 15);
};

mxArchiMateTech.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, 10);
	c.lineTo(10, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h - 10);
	c.lineTo(w - 10, h);
	c.lineTo(0, h);
	c.close();
	c.moveTo(0, 10);
	c.lineTo(w - 10, 10);
	c.lineTo(w - 10, h);
	c.moveTo(w, 0);
	c.lineTo(w - 10, 10);
	c.fillAndStroke();
};

mxArchiMateTech.prototype.foreground = function(c, x, y, w, h)
{
	var type = mxUtils.getValue(this.style, mxArchiMateTech.prototype.cst.TYPE, mxArchiMateTech.prototype.cst.DEVICE);
	
	c.setDashed(false);
	
	if (type === mxArchiMateTech.prototype.cst.DEVICE)
	{
		c.roundrect(0, 0, w, h * 0.88, w * 0.05, h * 0.05);
		c.stroke();
		c.begin();
		c.moveTo(w * 0.1, h * 0.88);
		c.lineTo(0, h);
		c.lineTo(w, h);
		c.lineTo(w * 0.9, h * 0.88);
		c.stroke();
	}
	else if (type === mxArchiMateTech.prototype.cst.PLATEAU)
	{
		var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
		c.setFillColor(strokeColor);
		
		c.rect(w * 0.4, 0, w * 0.6, h * 0.2);
		c.fill();
		
		c.rect(w * 0.2, h * 0.4, w * 0.6, h * 0.2);
		c.fill();
		
		c.rect(0, h * 0.8, w * 0.6, h * 0.2);
		c.fill();
	}
};

mxCellRenderer.registerShape(mxArchiMateTech.prototype.cst.TECH, mxArchiMateTech);

mxArchiMateTech.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, 10));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 10, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false, null, 0, -10));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false, null, -10, 0));
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
//Motivational
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMateMotivational(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMateMotivational, mxShape);

mxArchiMateMotivational.prototype.cst = {
		MOTIV : 'mxgraph.archimate.motiv',
		TYPE : 'motivType',
		STAKE : 'stake',
		DRIVER : 'driver',
		ASSESSMENT : 'assess',
		GOAL : 'goal',
		REQUIREMENT : 'req',
		CONSTRAINT : 'const',
		PRINCIPLE : 'princ'
};

mxArchiMateMotivational.prototype.customProperties = [
	{name: 'motivType', dispName: 'Motivational Type', type: 'enum', 
		enumList: [{val: 'stake', dispName: 'Stake'}, 
				   {val: 'driver', dispName: 'Driver'},
				   {val: 'assess', dispName: 'Assessment'},
				   {val: 'goal', dispName: 'Goal'},
				   {val: 'req', dispName: 'Requirement'},
				   {val: 'const', dispName: 'Constraint'},
				   {val: 'princ', dispName: 'Principle'}]
	}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMateMotivational.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	c.translate(w - 20, 5);
	this.foreground(c, w - 20, 5, 15, 15);
};

mxArchiMateMotivational.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(10, 0);
	c.lineTo(w - 10, 0);
	c.lineTo(w, 10);
	c.lineTo(w, h - 10);
	c.lineTo(w - 10, h);
	c.lineTo(10, h);
	c.lineTo(0, h - 10);
	c.lineTo(0, 10);
	c.close();
	c.fillAndStroke();
};

mxArchiMateMotivational.prototype.foreground = function(c, x, y, w, h)
{
	var type = mxUtils.getValue(this.style, mxArchiMateMotivational.prototype.cst.TYPE, mxArchiMateMotivational.prototype.cst.STAKE);
	
	c.setDashed(false);
	
	if (type === mxArchiMateMotivational.prototype.cst.STAKE)
	{
		c.translate(0, 4);
		h = h - 8;

		c.begin();
		c.moveTo(w * 0.8, 0);
		c.lineTo(w * 0.2, 0);
		c.arcTo(w * 0.2, h * 0.5, 0, 0, 0, w * 0.2, h);
		c.lineTo(w * 0.8, h);
		c.stroke();
		
		c.ellipse(w * 0.6, 0, w * 0.4, h);
		c.stroke();
	}
	else if (type === mxArchiMateMotivational.prototype.cst.DRIVER)
	{
		c.ellipse(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
		c.stroke();
		
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.moveTo(w * 0.5, 0);
		c.lineTo(w * 0.5, h);
		c.moveTo(w * 0.145, h * 0.145);
		c.lineTo(w * 0.855, h * 0.855);
		c.moveTo(w * 0.145, h * 0.855);
		c.lineTo(w * 0.855, h * 0.145);
		c.stroke();
		
		var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
		c.setFillColor(strokeColor);
		
		c.ellipse(w * 0.35, h * 0.35, w * 0.3, h * 0.3);
		c.fillAndStroke();
	}
	else if (type === mxArchiMateMotivational.prototype.cst.ASSESSMENT)
	{
		c.ellipse(w * 0.2, 0, w * 0.8, h * 0.8);
		c.stroke();
		
		c.begin();
		c.moveTo(0, h);
		c.lineTo(w * 0.32, h * 0.68);
		c.stroke();
	}
	else if (type === mxArchiMateMotivational.prototype.cst.GOAL)
	{
		c.ellipse(0, 0, w, h);
		c.stroke();
		c.ellipse(w * 0.15, h * 0.15, w * 0.7, h * 0.7);
		c.stroke();
		var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
		c.setFillColor(strokeColor);
		c.ellipse(w * 0.3, h * 0.3, w * 0.4, h * 0.4);
		c.fillAndStroke();
	}
	else if (type === mxArchiMateMotivational.prototype.cst.REQUIREMENT)
	{
		c.translate(0, 4);
		h = h - 8;

		c.begin();
		c.moveTo(w * 0.25, 0);
		c.lineTo(w, 0);
		c.lineTo(w * 0.75, h);
		c.lineTo(0, h);
		c.close();
		c.stroke();
	}
	else if (type === mxArchiMateMotivational.prototype.cst.CONSTRAINT)
	{
		c.translate(0, 4);
		h = h - 8;

		c.begin();
		c.moveTo(w * 0.25, 0);
		c.lineTo(w, 0);
		c.lineTo(w * 0.75, h);
		c.lineTo(0, h);
		c.close();
		c.moveTo(w * 0.45, 0);
		c.lineTo(w * 0.2, h);
		c.stroke();
	}
	else if (type === mxArchiMateMotivational.prototype.cst.PRINCIPLE)
	{
		c.begin();
		c.moveTo(w * 0.05, h * 0.05);
		c.arcTo(w * 2.3, h * 2.3, 0, 0, 1, w * 0.95, h * 0.05);
		c.arcTo(w * 2.3, h * 2.3, 0, 0, 1, w * 0.95, h * 0.95);
		c.arcTo(w * 2.3, h * 2.3, 0, 0, 1, w * 0.05, h * 0.95);
		c.arcTo(w * 2.3, h * 2.3, 0, 0, 1, w * 0.05, h * 0.05);
		c.close();
		c.stroke();
		
		var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
		c.setFillColor(strokeColor);
		
		c.begin();
		c.moveTo(w * 0.45, h * 0.7);
		c.lineTo(w * 0.42, h * 0.15);
		c.lineTo(w * 0.58, h * 0.15);
		c.lineTo(w * 0.55, h * 0.7);
		c.close();
		c.fill();
		
		c.rect(w * 0.45, h * 0.75, w * 0.1, h * 0.1);
		c.fill();
	}
};

mxCellRenderer.registerShape(mxArchiMateMotivational.prototype.cst.MOTIV, mxArchiMateMotivational);

mxArchiMateMotivational.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 5, 5));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false, null, -5, 5));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false, null, -5, -5));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false, null, 5, -5));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Gap
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMateGap(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMateGap, mxShape);

mxArchiMateGap.prototype.cst = {
		GAP : 'mxgraph.archimate.gap'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMateGap.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	c.translate(w - 20, 5);
	this.foreground(c, w - 20, 5, 15, 15);
};

mxArchiMateGap.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h * 0.85);
	c.arcTo(w * 0.35, h * 0.35, 0, 0, 0, w * 0.5, h * 0.85);
	c.arcTo(w * 0.35, h * 0.35, 0, 0, 1, 0, h * 0.85);
	c.close();
	c.fillAndStroke();
};

mxArchiMateGap.prototype.foreground = function(c, x, y, w, h)
{
	c.setDashed(false);
	
	c.translate(0, 2);
	h = h - 4;

	c.ellipse(w * 0.15, 0, w * 0.7, h);
	c.stroke();
	
	c.begin();
	c.moveTo(0, h * 0.35);
	c.lineTo(w, h * 0.35);
	c.moveTo(0, h * 0.65);
	c.lineTo(w, h * 0.65);
	c.stroke();
};

mxCellRenderer.registerShape(mxArchiMateGap.prototype.cst.GAP, mxArchiMateGap);

mxArchiMateGap.prototype.getConstraints = function(style, w, h)
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
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.85), false, null));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0.745), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0.85), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0.955), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.85), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));

	return (constr);
};
