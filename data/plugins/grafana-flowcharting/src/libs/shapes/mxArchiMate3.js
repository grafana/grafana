/**
 * $Id: mxArchiMate3.js,v 1.0 2016/08/18 07:05:39 mate Exp $
 * Copyright (c) 2006-2016, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Application
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Application(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Application, mxShape);

mxArchiMate3Application.prototype.cst = {
		APPLICATION : 'mxgraph.archimate3.application',
		TYPE : 'appType',
		COMPONENT : 'comp',
		COLLABORATION : 'collab',
		INTERFACE : 'interface',
		INTERFACE2 : 'interface2',
		LOCATION : 'location',
		FUNCTION : 'func',
		INTERACTION : 'interaction',
		SERVICE : 'serv',
		EVENT : 'event',
		EVENT2 : 'event2',
		NODE : 'node',
		NETWORK : 'netw',
		COMM_PATH : 'commPath',
		ACTOR : 'actor',
		ASSESSMENT : 'assess',
		GOAL : 'goal',
		OUTCOME : 'outcome',
		ROLE : 'role',
		PROCESS : 'proc',
		DRIVER : 'driver',
		PRINCIPLE : 'principle',
		REQUIREMENT : 'requirement',
		CONSTRAINT : 'constraint',
		RESOURCE : 'resource',
		CAPABILITY : 'capability',
		COURSE : 'course',
		MATERIAL : 'material',
		DISTRIBUTION : 'distribution',
		SYS_SW : 'sysSw',
		ARTIFACT : 'artifact',
		PATH : 'path',
		ARCHI_TYPE : 'archiType',
		TYPE_SQUARE : 'square',
		TYPE_ROUNDED : 'rounded',
		TYPE_OCT : 'oct'
};

mxArchiMate3Application.prototype.customProperties = [
	{name: 'archiType', dispName: 'Type', type: 'enum', 
		enumList: [{val: 'square', dispName: 'Square'}, 
			       {val: 'rounded', dispName: 'Rounded'}, 
			       {val: 'oct', dispName: 'Octagonal'}]
	},
	{name: 'appType', dispName: 'App Type', type: 'enum', 
		enumList: [{val: 'comp', dispName: 'Component'}, 
				   {val: 'collab', dispName: 'Collaboration'}, 
				   {val: 'interface', dispName: 'Interface'}, 
				   {val: 'interface2', dispName: 'Interface2'}, 
				   {val: 'func', dispName: 'Function'}, 
				   {val: 'interaction', dispName: 'Interaction'}, 
				   {val: 'location', dispName: 'Location'}, 
				   {val: 'serv', dispName: 'Service'}, 
				   {val: 'event', dispName: 'Event'}, 
				   {val: 'event2', dispName: 'Event2'}, 
				   {val: 'node', dispName: 'Node'}, 
				   {val: 'netw', dispName: 'Network'}, 
				   {val: 'commPath', dispName: 'Comm Path'}, 
				   {val: 'actor', dispName: 'Actor'}, 
				   {val: 'assess', dispName: 'Assessment'}, 
				   {val: 'goal', dispName: 'Goal'}, 
				   {val: 'outcome', dispName: 'Outcome'}, 
				   {val: 'role', dispName: 'Role'}, 
				   {val: 'proc', dispName: 'Process'}, 
				   {val: 'driver', dispName: 'Driver'}, 
				   {val: 'principle', dispName: 'Principle'}, 
				   {val: 'requirement', dispName: 'Requirement'}, 
				   {val: 'constraint', dispName: 'Constraint'}, 
				   {val: 'resource', dispName: 'Resource'}, 
				   {val: 'capability', dispName: 'Capability'}, 
				   {val: 'course', dispName: 'Course'}, 
				   {val: 'material', dispName: 'Material'}, 
				   {val: 'distribution', dispName: 'Distribution'}, 
				   {val: 'sysSw', dispName: 'System Sw'}, 
				   {val: 'artifact', dispName: 'Artifact'}, 
				   {val: 'path', dispName: 'Path'}]
}];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Application.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	c.translate(w - 20, 5);
	this.foreground(c, w - 20, 5, 15, 15);
};

mxArchiMate3Application.prototype.background = function(c, x, y, w, h)
{
	var archiType = mxUtils.getValue(this.style, mxArchiMate3Application.prototype.cst.ARCHI_TYPE, 'square');

	if (archiType === 'rounded')
	{
		c.roundrect(0, 0, w, h, 10, 10);
	}
	else if ((archiType === 'oct') && w >= 20 && h >= 20)
	{
		c.begin();
		c.moveTo(0, 10);
		c.lineTo(10, 0);
		c.lineTo(w - 10, 0);
		c.lineTo(w, 10);
		c.lineTo(w, h - 10);
		c.lineTo(w - 10, h);
		c.lineTo(10, h);
		c.lineTo(0, h - 10);
		c.close();
		c.fillAndStroke();
	}
	else
	{
		c.rect(0, 0, w, h);
	}

	c.fillAndStroke();
};

mxArchiMate3Application.prototype.foreground = function(c, x, y, w, h)
{
	var type = mxUtils.getValue(this.style, mxArchiMate3Application.prototype.cst.TYPE, '');
	
	c.setDashed(false);
	
	if (type === mxArchiMate3Application.prototype.cst.COMPONENT)
	{
		c.translate(1, 0);
		w = w - 2;

		mxArchiMate3Component.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.COLLABORATION)
	{
		c.translate(0, 3);
		h = h - 6;
		
		mxArchiMate3Collaboration.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.INTERFACE)
	{
		c.translate(0, 4);
		h = h - 8;
		
		mxArchiMate3Interface.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.INTERFACE2)
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
	else if (type === mxArchiMate3Application.prototype.cst.FUNCTION)
	{
		mxArchiMate3Function.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.INTERACTION)
	{
		mxArchiMate3Interaction.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.LOCATION)
	{
		c.translate(3, 0);
		w = w - 6;
		c.begin();
		c.moveTo(w * 0.5, h);
		c.arcTo(w * 0.1775, h * 0.3, 0, 0, 0, w * 0.345, h * 0.7);
		c.arcTo(w * 0.538, h * 0.364, 0, 0, 1, w * 0.5, 0);
		c.arcTo(w * 0.538, h * 0.364, 0, 0, 1, w * 0.655, h * 0.7);
		c.arcTo(w * 0.1775, h * 0.3, 0, 0, 0, w * 0.5, h);
		c.stroke();
	}
	else if (type === mxArchiMate3Application.prototype.cst.SERVICE)
	{
		c.translate(0, 3);
		h = h - 6;
		
		mxArchiMate3Service.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.EVENT)
	{
		c.translate(0, 3);
		h = h - 6;
		
		mxArchiMate3Event.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.EVENT2)
	{
		c.translate(0, 3);
		h = h - 6;
		
		mxArchiMate3Event2.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.NODE)
	{
		mxArchiMate3Node.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.NETWORK)
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
	else if (type === mxArchiMate3Application.prototype.cst.COMM_PATH)
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
	else if (type === mxArchiMate3Application.prototype.cst.ARTIFACT)
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
	else if (type === mxArchiMate3Application.prototype.cst.ACTOR)
	{
		c.translate(3, 0);
		w = w - 6;
		
		mxArchiMate3Actor.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.ROLE)
	{
		c.translate(0, 4);
		h = h - 8;

		mxArchiMate3Role.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.PROCESS)
	{
		c.translate(0, 3);
		h = h - 6;

		mxArchiMate3Process.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.DRIVER)
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
	else if (type === mxArchiMate3Application.prototype.cst.ASSESSMENT)
	{
		c.ellipse(w * 0.2, 0, w * 0.8, h * 0.8);
		c.stroke();
		
		c.begin();
		c.moveTo(0, h);
		c.lineTo(w * 0.32, h * 0.68);
		c.stroke();
	}
	else if (type === mxArchiMate3Application.prototype.cst.GOAL)
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
	else if (type === mxArchiMate3Application.prototype.cst.OUTCOME)
	{
		c.ellipse(0, w * 0.2, w * 0.8, h * 0.8);
		c.stroke();
		c.ellipse(w * 0.15, w * 0.35, w * 0.5, h * 0.5);
		c.stroke();
		c.ellipse(w * 0.3, w * 0.5, w * 0.2, h * 0.2);
		c.stroke();
		
		c.begin();
		c.moveTo(w * 0.4, h * 0.6);
		c.lineTo(w * 0.9, h * 0.1);
		c.moveTo(w * 0.42, h * 0.4);
		c.lineTo(w * 0.4, h * 0.6);
		c.lineTo(w * 0.6, h * 0.58);
		c.moveTo(w * 0.8, 0);
		c.lineTo(w * 0.75, h * 0.25);
		c.lineTo(w, h * 0.2);
		c.stroke();
	}
	else if (type === mxArchiMate3Application.prototype.cst.PRINCIPLE)
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
	else if (type === mxArchiMate3Application.prototype.cst.REQUIREMENT)
	{
		c.translate(0, 4);
		h = h - 8;

		mxArchiMate3Requirement.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.CONSTRAINT)
	{
		c.translate(0, 4);
		h = h - 8;

		mxArchiMate3Constraint.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.MATERIAL)
	{
		c.translate(0, 1);
		h = h - 2;
		
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w * 0.25, 0);
		c.lineTo(w * 0.75, 0);
		c.lineTo(w, h * 0.5);
		c.lineTo(w * 0.75, h);
		c.lineTo(w * 0.25, h);
		c.close();
		c.moveTo(w * 0.15, h * 0.5);
		c.lineTo(w * 0.31, h * 0.2);
		c.moveTo(w * 0.69, h * 0.2);
		c.lineTo(w * 0.85, h * 0.5);
		c.moveTo(w * 0.68, h * 0.80);
		c.lineTo(w * 0.32, h * 0.80);
		c.stroke();
	}
	else if (type === mxArchiMate3Application.prototype.cst.DISTRIBUTION)
	{
		c.translate(0, 4);
		h = h - 8;
		
		mxArchiMate3Distribution.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.RESOURCE)
	{
		c.translate(0, 1);
		h = h - 2;
		
		mxArchiMate3Resource.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.CAPABILITY)
	{
		mxArchiMate3Capability.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.COURSE)
	{
		mxArchiMate3Course.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.SYS_SW)
	{
		mxArchiMate3SysSw.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.ARTIFACT)
	{
		c.translate(2, 0);
		w = w - 4;
		
		mxArchiMate3Artifact.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Application.prototype.cst.PATH)
	{
		c.translate(0, 5);
		h = h - 10;
		
		mxArchiMate3Path.prototype.background(c, x, y, w, h);
	}
};

mxCellRenderer.registerShape(mxArchiMate3Application.prototype.cst.APPLICATION, mxArchiMate3Application);

mxArchiMate3Application.prototype.getConstraints = function(style, w, h)
{
	var constr = [];
	var archiType = mxUtils.getValue(this.style, mxArchiMate3Application.prototype.cst.ARCHI_TYPE, 'square');

	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.25), false));

	if (archiType === 'rounded')
	{
		constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 2.9, 2.9));
		constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false, null, -2.9, 2.9));
		constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false, null, -2.9, -2.9));
		constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false, null, 2.9, -2.9));
	}
	else if ((archiType === 'oct') && w >= 20 && h >= 20)
	{
		constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 5, 5));
		constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false, null, -5, 5));
		constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false, null, -5, -5));
		constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false, null, 5, -5));
	}
	else
	{
		constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false));
		constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false));
		constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false));
		constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false));
	}

	return (constr);
};

//**********************************************************************************************************************************************************
//Component
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Component(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Component, mxShape);

mxArchiMate3Component.prototype.cst = {
		COMPONENT : 'mxgraph.archimate3.component'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Component.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Component.prototype.background = function(c, x, y, w, h)
{
	c.rect(w * 0.25, 0, w * 0.75, h);
	c.fillAndStroke();
	
	c.rect(0, h * 0.25, w * 0.5, h * 0.15);
	c.fillAndStroke();
	
	c.rect(0, h * 0.6, w * 0.5, h * 0.15);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Component.prototype.cst.COMPONENT, mxArchiMate3Component);

mxArchiMate3Component.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0.625, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.625, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.325), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.675), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Collaboration
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Collaboration(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Collaboration, mxShape);

mxArchiMate3Collaboration.prototype.cst = {
		COLLABORATION : 'mxgraph.archimate3.collaboration'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Collaboration.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Collaboration.prototype.background = function(c, x, y, w, h)
{
	c.ellipse(0, 0, w * 0.6, h);
	c.fillAndStroke();
	c.ellipse(w * 0.4, 0, w * 0.6, h);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Collaboration.prototype.cst.COLLABORATION, mxArchiMate3Collaboration);

mxArchiMate3Collaboration.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0.11, 0.11), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0.125), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.89, 0.11), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.11, 0.89), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0.875), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.89, 0.89), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.3, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.7, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.3, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.7, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Interface
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Interface(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Interface, mxShape);

mxArchiMate3Interface.prototype.cst = {
		INTERFACE : 'mxgraph.archimate3.interface'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Interface.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Interface.prototype.background = function(c, x, y, w, h)
{
	c.ellipse(w * 0.5, 0, w * 0.5, h);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w * 0.5, h * 0.5);
	c.stroke();
};

mxCellRenderer.registerShape(mxArchiMate3Interface.prototype.cst.INTERFACE, mxArchiMate3Interface);

mxArchiMate3Interface.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Process
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Process(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Process, mxShape);

mxArchiMate3Process.prototype.cst = {
		PROCESS : 'mxgraph.archimate3.process'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Process.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Process.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, h * 0.3);
	c.lineTo(w * 0.6, h * 0.3);
	c.lineTo(w * 0.6, 0);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.6, h);
	c.lineTo(w * 0.6, h * 0.7);
	c.lineTo(0, h * 0.7);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Process.prototype.cst.PROCESS, mxArchiMate3Process);

mxArchiMate3Process.prototype.getConstraints = function(style, w, h)
{
	var constr = [];
	
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.3), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.3, 0.3), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.6, 0.3), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.6, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.6, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.6, 0.7), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.3, 0.7), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.7), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Function
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Function(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Function, mxShape);

mxArchiMate3Function.prototype.cst = {
		FUNCTION : 'mxgraph.archimate3.function'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Function.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Function.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w * 0.5, 0);
	c.lineTo(w, h * 0.2);
	c.lineTo(w, h);
	c.lineTo(w * 0.5, h * 0.8);
	c.lineTo(0, h);
	c.lineTo(0, h * 0.2);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Function.prototype.cst.FUNCTION, mxArchiMate3Function);

mxArchiMate3Function.prototype.getConstraints = function(style, w, h)
{
	var constr = [];
	
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.2), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.6), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0.8), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.6), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.2), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Interaction
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Interaction(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Interaction, mxShape);

mxArchiMate3Interaction.prototype.cst = {
		INTERACTION : 'mxgraph.archimate3.interaction'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Interaction.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Interaction.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w * 0.55, 0);
	c.arcTo(w * 0.45, h * 0.5, 0, 0, 1, w * 0.55, h);
	c.close();
	c.moveTo(w * 0.45, 0);
	c.arcTo(w * 0.45, h * 0.5, 0, 0, 0, w * 0.45, h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Interaction.prototype.cst.INTERACTION, mxArchiMate3Interaction);

mxArchiMate3Interaction.prototype.getConstraints = function(style, w, h)
{
	var constr = [];
	
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.86, 0.14), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.86, 0.86), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.14, 0.86), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.14, 0.14), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Service
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Service(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Service, mxShape);

mxArchiMate3Service.prototype.cst = {
		SERVICE : 'mxgraph.archimate3.service'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Service.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Service.prototype.background = function(c, x, y, w, h)
{
	var w1 = Math.max(w - h * 0.5, w * 0.5);
	var w2 = Math.min(h * 0.5, w * 0.5);
	
	c.begin();
	c.moveTo(w1, 0);
	c.arcTo(h * 0.5, h * 0.5, 0, 0, 1, w1, h);
	c.lineTo(w2, h);
	c.arcTo(h * 0.5, h * 0.5, 0, 0, 1, w2, 0);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Service.prototype.cst.SERVICE, mxArchiMate3Service);

mxArchiMate3Service.prototype.getConstraints = function(style, w, h)
{
	var constr = [];
	var w1 = Math.max(w - h * 0.5, w * 0.5);
	var w2 = Math.min(h * 0.5, w * 0.5);
	
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w1, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w1, h));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w2, h));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w2, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w1 + h * 0.355, h * 0.145));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w1 + h * 0.5, h * 0.5));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w1 + h * 0.355, h * 0.855));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w2 - h * 0.355, h * 0.145));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w2 - h * 0.5, h * 0.5));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w2 - h * 0.355, h * 0.855));

	return (constr);
};

//**********************************************************************************************************************************************************
//Requirement
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Requirement(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Requirement, mxShape);

mxArchiMate3Requirement.prototype.cst = {
		REQUIREMENT : 'mxgraph.archimate3.requirement'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Requirement.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Requirement.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w * 0.25, 0);
	c.lineTo(w, 0);
	c.lineTo(w * 0.75, h);
	c.lineTo(0, h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Requirement.prototype.cst.REQUIREMENT, mxArchiMate3Requirement);

mxArchiMate3Requirement.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.9375, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.875, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.8125, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.0625, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.125, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.1875, 0.25), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Constraint
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Constraint(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Constraint, mxShape);

mxArchiMate3Constraint.prototype.cst = {
		CONSTRAINT : 'mxgraph.archimate3.constraint'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Constraint.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Constraint.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w * 0.25, 0);
	c.lineTo(w, 0);
	c.lineTo(w * 0.75, h);
	c.lineTo(0, h);
	c.close();
	c.moveTo(w * 0.45, 0);
	c.lineTo(w * 0.2, h);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Constraint.prototype.cst.CONSTRAINT, mxArchiMate3Constraint);

mxArchiMate3Constraint.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.9375, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.875, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.8125, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.0625, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.125, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.1875, 0.25), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Event
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Event(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Event, mxShape);

mxArchiMate3Event.prototype.cst = {
		EVENT : 'mxgraph.archimate3.event'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Event.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Event.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w - h * 0.5, 0);
	c.arcTo(h * 0.5, h * 0.5, 0, 0, 1, w - h * 0.5, h);
	c.lineTo(0, h);
	c.lineTo(h * 0.5, h * 0.5);
	c.lineTo(0, 0);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Event.prototype.cst.EVENT, mxArchiMate3Event);

mxArchiMate3Event.prototype.getConstraints = function(style, w, h)
{
	var constr = [];
	var w1 = Math.max(w - h * 0.5, w * 0.5);
	var w2 = Math.min(h * 0.5, w * 0.5);
	
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - h * 0.5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w - h * 0.5, h));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, h));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, h * 0.5, h * 0.5));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, (w - h * 0.5) * 0.5, 0));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, (w - h * 0.5) * 0.5, h));

	return (constr);
};

//**********************************************************************************************************************************************************
//Event 2
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Event2(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Event2, mxShape);

mxArchiMate3Event2.prototype.cst = {
		EVENT2 : 'mxgraph.archimate3.event2'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Event2.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Event2.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w - h * 0.5, 0);
	c.arcTo(h * 0.5, h * 0.5, 0, 0, 1, w - h * 0.5, h);
	c.lineTo(0, h);
	c.arcTo(h * 0.5, h * 0.5, 0, 0, 0, 0, 0);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Event2.prototype.cst.EVENT2, mxArchiMate3Event2);

//**********************************************************************************************************************************************************
//Actor
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Actor(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Actor, mxShape);

mxArchiMate3Actor.prototype.cst = {
		ACTOR : 'mxgraph.archimate3.actor'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Actor.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Actor.prototype.background = function(c, x, y, w, h)
{
	c.ellipse(w * 0.2, 0, w * 0.6, h * 0.3);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w * 0.5, h * 0.3);
	c.lineTo(w * 0.5, h * 0.75);
	c.moveTo(0, h * 0.45);
	c.lineTo(w, h * 0.45);
	c.moveTo(0, h);
	c.lineTo(w * 0.5, h * 0.75);
	c.lineTo(w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxArchiMate3Actor.prototype.cst.ACTOR, mxArchiMate3Actor);

mxArchiMate3Actor.prototype.getConstraints = function(style, w, h)
{
	var constr = [];
	
	constr.push(new mxConnectionConstraint(new mxPoint(0.2, 0.15), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.8, 0.15), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.45), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.45), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 1), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Role
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Role(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Role, mxShape);

mxArchiMate3Role.prototype.cst = {
		ROLE : 'mxgraph.archimate3.role'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Role.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Role.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w * 0.8, 0);
	c.lineTo(w * 0.2, 0);
	c.arcTo(w * 0.2, h * 0.5, 0, 0, 0, w * 0.2, h);
	c.lineTo(w * 0.8, h);
	c.fillAndStroke();

	c.ellipse(w * 0.6, 0, w * 0.4, h);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Role.prototype.cst.ROLE, mxArchiMate3Role);

mxArchiMate3Role.prototype.getConstraints = function(style, w, h)
{
	var constr = [];
	
	constr.push(new mxConnectionConstraint(new mxPoint(0.2, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.8, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.8, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.2, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Business Object
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3BusinessObject(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3BusinessObject, mxShape);

mxArchiMate3BusinessObject.prototype.cst = {
		BUSINESS_OBJECT : 'mxgraph.archimate3.businessObject'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3BusinessObject.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h);
};

mxArchiMate3BusinessObject.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxArchiMate3BusinessObject.prototype.foreground = function(c, x, y, w, h)
{
	if (h >= 15)
	{
		c.begin();
		c.moveTo(0, 15);
		c.lineTo(w, 15);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxArchiMate3BusinessObject.prototype.cst.BUSINESS_OBJECT, mxArchiMate3BusinessObject);

mxArchiMate3BusinessObject.prototype.getConstraints = function(style, w, h)
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
//Contract
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Contract(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Contract, mxShape);

mxArchiMate3Contract.prototype.cst = {
		CONTRACT : 'mxgraph.archimate3.contract'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Contract.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h);
};

mxArchiMate3Contract.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxArchiMate3Contract.prototype.foreground = function(c, x, y, w, h)
{
	if (h >= 15)
	{
		c.begin();
		c.moveTo(0, 15);
		c.lineTo(w, 15);
		c.stroke();
	}
	
	if (h >= 30)
	{
		c.begin();
		c.moveTo(0, h - 15);
		c.lineTo(w,  h - 15);
		c.stroke();
	}

};

mxCellRenderer.registerShape(mxArchiMate3Contract.prototype.cst.CONTRACT, mxArchiMate3Contract);

mxArchiMate3Contract.prototype.getConstraints = function(style, w, h)
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
//Product
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Product(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Product, mxShape);

mxArchiMate3Product.prototype.cst = {
		PRODUCT : 'mxgraph.archimate3.product'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Product.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	this.foreground(c, 0, 0, w, h);
};

mxArchiMate3Product.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxArchiMate3Product.prototype.foreground = function(c, x, y, w, h)
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

mxCellRenderer.registerShape(mxArchiMate3Product.prototype.cst.PRODUCT, mxArchiMate3Product);

mxArchiMate3Product.prototype.getConstraints = function(style, w, h)
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
//Representation
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Representation(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Representation, mxShape);

mxArchiMate3Representation.prototype.cst = {
		REPRESENTATION : 'mxgraph.archimate3.representation'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Representation.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
};

mxArchiMate3Representation.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h * 0.85);
	c.arcTo(w * 0.35, h * 0.35, 0, 0, 0, w * 0.5, h * 0.85);
	c.arcTo(w * 0.35, h * 0.35, 0, 0, 1, 0, h * 0.85);
	c.close();
	c.fillAndStroke();
	
	if (h >= 20)
	c.begin();
	c.moveTo(0, 15);
	c.lineTo(w, 15);
	c.stroke();
};

mxCellRenderer.registerShape(mxArchiMate3Representation.prototype.cst.REPRESENTATION, mxArchiMate3Representation);

mxArchiMate3Representation.prototype.getConstraints = function(style, w, h)
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
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.85), false));
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
//Deliverable
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Deliverable(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Deliverable, mxShape);

mxArchiMate3Deliverable.prototype.cst = {
		DELIVERABLE : 'mxgraph.archimate3.deliverable'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Deliverable.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
};

mxArchiMate3Deliverable.prototype.background = function(c, x, y, w, h)
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

mxCellRenderer.registerShape(mxArchiMate3Deliverable.prototype.cst.DELIVERABLE, mxArchiMate3Deliverable);

mxArchiMate3Deliverable.prototype.getConstraints = function(style, w, h)
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
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.85), false));
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
//Location
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Location(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Location, mxShape);

mxArchiMate3Location.prototype.cst = {
		LOCATION : 'mxgraph.archimate3.location'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Location.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	c.translate(w - 20, 5);
	this.foreground(c, w - 20, 5, 15, 15);
};

mxArchiMate3Location.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxArchiMate3Location.prototype.foreground = function(c, x, y, w, h)
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

mxCellRenderer.registerShape(mxArchiMate3Location.prototype.cst.LOCATION, mxArchiMate3Location);

//**********************************************************************************************************************************************************
//Gap
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Gap(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Gap, mxShape);

mxArchiMate3Gap.prototype.cst = {
		GAP : 'mxgraph.archimate3.gap'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Gap.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	c.translate(w - 20, 5);
	this.foreground(c, w - 20, 5, 15, 15);
};

mxArchiMate3Gap.prototype.background = function(c, x, y, w, h)
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

mxArchiMate3Gap.prototype.foreground = function(c, x, y, w, h)
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

mxCellRenderer.registerShape(mxArchiMate3Gap.prototype.cst.GAP, mxArchiMate3Gap);

mxArchiMate3Gap.prototype.getConstraints = function(style, w, h)
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
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.85), false));
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
//Tech
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Tech(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Tech, mxShape);

mxArchiMate3Tech.prototype.cst = {
		TECH : 'mxgraph.archimate3.tech',
		TYPE : 'techType',
		DEVICE : 'device',
		PLATEAU : 'plateau',
		FACILITY : 'facility',
		EQUIPMENT : 'equipment',
		SYS_SW : 'sysSw'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Tech.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
	c.translate(w - 30, 15);
	this.foreground(c, w - 30, 15, 15, 15);
};

mxArchiMate3Tech.prototype.background = function(c, x, y, w, h)
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

mxArchiMate3Tech.prototype.foreground = function(c, x, y, w, h)
{
	var type = mxUtils.getValue(this.style, mxArchiMate3Tech.prototype.cst.TYPE, mxArchiMate3Tech.prototype.cst.DEVICE);
	
	c.setDashed(false);
	
	if (type === mxArchiMate3Tech.prototype.cst.PLATEAU)
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
	else if (type === mxArchiMate3Tech.prototype.cst.FACILITY)
	{
		c.begin();
		c.moveTo(0, h);
		c.lineTo(0, 0);
		c.lineTo(w * 0.13, 0);
		c.lineTo(w * 0.13, h * 0.7);
		c.lineTo(w * 0.42, h * 0.55);
		c.lineTo(w * 0.42, h * 0.7);
		c.lineTo(w * 0.71, h * 0.55);
		c.lineTo(w * 0.71, h * 0.7);
		c.lineTo(w, h * 0.55);
		c.lineTo(w, h);
		c.close();
		c.stroke();
	}
	else if (type === mxArchiMate3Tech.prototype.cst.EQUIPMENT)
	{
		c.begin();
		c.moveTo(w * 0.72, h * 0.38);
		c.curveTo(w * 0.78, w * 0.38, w * 0.85, h * 0.34, w * 0.85, h * 0.26);
		c.curveTo(w * 0.85, w * 0.18, w * 0.78, h * 0.14, w * 0.73, h * 0.14);
		c.curveTo(w * 0.64, w * 0.14, w * 0.59, h * 0.2, w * 0.59, h * 0.26);
		c.curveTo(w * 0.59, h * 0.33, w * 0.65, w * 0.38, w * 0.72, h * 0.38);
		c.close();
		c.moveTo(w * 0.68, h * 0.52);
		c.lineTo(w * 0.67, h * 0.45);
		c.lineTo(w * 0.61, h * 0.43);
		c.lineTo(w * 0.56, h * 0.48);
		c.lineTo(w * 0.5, h * 0.42);
		c.lineTo(w * 0.54, h * 0.36);
		c.lineTo(w * 0.52, h * 0.31);
		c.lineTo(w * 0.45, h * 0.31);
		c.lineTo(w * 0.45, h * 0.22);
		c.lineTo(w * 0.52, h * 0.21);
		c.lineTo(w * 0.54, h * 0.16);
		c.lineTo(w * 0.5, h * 0.11);
		c.lineTo(w * 0.56, h * 0.05);
		c.lineTo(w * 0.62, h * 0.09);
		c.lineTo(w * 0.67, h * 0.07);
		c.lineTo(w * 0.68, 0);
		c.lineTo(w * 0.77, 0);
		c.lineTo(w * 0.78, h * 0.07);
		c.lineTo(w * 0.83, h * 0.09);
		c.lineTo(w * 0.89, h * 0.05);
		c.lineTo(w * 0.95, h * 0.11);
		c.lineTo(w * 0.91, h * 0.16);
		c.lineTo(w * 0.93, h * 0.21);
		c.lineTo(w, h * 0.22);
		c.lineTo(w, h * 0.31);
		c.lineTo(w * 0.93, h * 0.31);
		c.lineTo(w * 0.91, h * 0.36);
		c.lineTo(w * 0.95, h * 0.41);
		c.lineTo(w * 0.89, h * 0.47);
		c.lineTo(w * 0.83, h * 0.43);
		c.lineTo(w * 0.78, h * 0.45);
		c.lineTo(w * 0.77, h * 0.52);
		c.lineTo(w * 0.68, h * 0.52);
		c.close();
		c.moveTo(w * 0.36, h * 0.81);
		c.curveTo(w * 0.44, h * 0.81, w * 0.52, h * 0.75, w * 0.52, h * 0.67);
		c.curveTo(w * 0.52, h * 0.59, w * 0.45, h * 0.51, w * 0.35, h * 0.51);
		c.curveTo(w * 0.27, h * 0.51, w * 0.19, h * 0.58, w * 0.19, h * 0.67);
		c.curveTo(w * 0.19, h * 0.74, w * 0.27, h * 0.82, w * 0.36, h * 0.81);
		c.close();
		c.moveTo(w * 0.21, h * 0.98);
		c.lineTo(w * 0.22, h * 0.89);
		c.lineTo(w * 0.16, h * 0.85);
		c.lineTo(w * 0.08, h * 0.88);
		c.lineTo(w * 0.02, h * 0.79);
		c.lineTo(w * 0.09, h * 0.74);
		c.lineTo(w * 0.08, h * 0.67);
		c.lineTo(0, h * 0.63);
		c.lineTo(w * 0.03, h * 0.53);
		c.lineTo(w * 0.12, h * 0.54);
		c.lineTo(w * 0.16, h * 0.48);
		c.lineTo(w * 0.13, h * 0.4);
		c.lineTo(w * 0.22, h * 0.35);
		c.lineTo(w * 0.28, h * 0.42);
		c.lineTo(w * 0.36, h * 0.41);
		c.lineTo(w * 0.39, h * 0.33);
		c.lineTo(w * 0.5, h * 0.36);
		c.lineTo(w * 0.49, h * 0.45);
		c.lineTo(w * 0.55, h * 0.49);
		c.lineTo(w * 0.63, h * 0.45);
		c.lineTo(w * 0.69, h * 0.54);
		c.lineTo(w * 0.62, h * 0.6);
		c.lineTo(w * 0.63, h * 0.67);
		c.lineTo(w * 0.71, h * 0.7);
		c.lineTo(w * 0.68, h * 0.8);
		c.lineTo(w * 0.59, h * 0.79);
		c.lineTo(w * 0.55, h * 0.85);
		c.lineTo(w * 0.59, h * 0.79);
		c.lineTo(w * 0.55, h * 0.85);
		c.lineTo(w * 0.59, h * 0.93);
		c.lineTo(w * 0.49, h * 0.98);
		c.lineTo(w * 0.43, h * 0.91);
		c.lineTo(w * 0.36, h * 0.92);
		c.lineTo(w * 0.32, h);
		c.lineTo(w * 0.21, h * 0.98);
		c.close();
		c.stroke();
	}
	else if (type === mxArchiMate3Tech.prototype.cst.SYS_SW)
	{
		mxArchiMate3SysSw.prototype.background(c, x, y, w, h);
	}
	else if (type === mxArchiMate3Tech.prototype.cst.DEVICE)
	{
		mxArchiMate3Device.prototype.background(c, x, y, w, h);
	}
};

mxCellRenderer.registerShape(mxArchiMate3Tech.prototype.cst.TECH, mxArchiMate3Tech);

mxArchiMate3Tech.prototype.getConstraints = function(style, w, h)
{
	var constr = [];
	
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
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 0, 10));

	return (constr);
};

//**********************************************************************************************************************************************************
//Distribution
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Distribution(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Distribution, mxShape);

mxArchiMate3Distribution.prototype.cst = {
		DISTRIBUTION : 'mxgraph.archimate3.distribution'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Distribution.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Distribution.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w * 0.1, h * 0.25);
	c.lineTo(w * 0.9, h * 0.25);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.9, h * 0.75);
	c.lineTo(w * 0.1, h * 0.75);
	c.lineTo(0, h * 0.5);
	c.fillAndStroke();
	c.begin();
	c.moveTo(w * 0.2, 0);
	c.lineTo(0, h * 0.5);
	c.lineTo(w * 0.2, h);
	c.moveTo(w * 0.8, 0);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.8, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxArchiMate3Distribution.prototype.cst.DISTRIBUTION, mxArchiMate3Distribution);

mxArchiMate3Distribution.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.2, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.8, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.8, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.2, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Resource
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Resource(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Resource, mxShape);

mxArchiMate3Resource.prototype.cst = {
		RESOURCE : 'mxgraph.archimate3.resource'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Resource.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Resource.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w * 0.51, h * 0.34);
	c.lineTo(w * 0.51, h * 0.65);
	c.moveTo(w * 0.35, h * 0.34);
	c.lineTo(w * 0.35, h * 0.65);
	c.moveTo(w * 0.19, h * 0.34);
	c.lineTo(w * 0.19, h * 0.65);
	c.moveTo(w * 0.91, h * 0.4);
	c.curveTo(w * 0.93, h * 0.39, w * 0.95, h * 0.39, w * 0.97, h * 0.40);
	c.curveTo(w * 0.99, h * 0.4, w, h * 0.41, w, h * 0.43);
	c.curveTo(w, h * 0.48, w, h * 0.52, w, h * 0.57);
	c.curveTo(w, h * 0.58, w * 0.99, h * 0.59, w * 0.98, h * 0.6);
	c.curveTo(w * 0.96, h * 0.6, w * 0.93, h * 0.6, w * 0.91, h * 0.6);
	c.moveTo(0, h * 0.73);
	c.curveTo(0, h * 0.6, 0, h * 0.43, 0, h * 0.27);
	c.curveTo(0, h * 0.24, w * 0.03, h * 0.21, w * 0.08, h * 0.21);
	c.curveTo(w * 0.33, h * 0.2, w * 0.61, h * 0.2, w * 0.84, h * 0.21);
	c.curveTo(w * 0.88, h * 0.22, w * 0.89, h * 0.24, w * 0.9, h * 0.26);
	c.curveTo(w * 0.91, h * 0.41, w * 0.91, h * 0.57, w * 0.9, h * 0.72);
	c.curveTo(w * 0.9, h * 0.74, w * 0.88, h * 0.78, w * 0.83, h * 0.79);
	c.curveTo(w * 0.57, h * 0.79, w * 0.32, h * 0.79, w * 0.06, h * 0.79);
	c.curveTo(w * 0.02, h * 0.78, 0, h * 0.76, 0, h * 0.73);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxArchiMate3Resource.prototype.cst.RESOURCE, mxArchiMate3Resource);

//**********************************************************************************************************************************************************
//Capability
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Capability(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Capability, mxShape);

mxArchiMate3Capability.prototype.cst = {
		CAPABILITY : 'mxgraph.archimate3.capability'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Capability.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Capability.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w, 0);
	c.lineTo(w, h);
	c.lineTo(0, h);
	c.lineTo(0, h * 0.67);
	c.lineTo(w * 0.33, h * 0.67);
	c.lineTo(w * 0.33, h * 0.33);
	c.lineTo(w * 0.67, h * 0.33);
	c.lineTo(w * 0.67, 0);
	c.close();
	c.moveTo(w * 0.67, h * 0.33);
	c.lineTo(w, h * 0.33);
	c.moveTo(w * 0.33, h * 0.67);
	c.lineTo(w, h * 0.67);
	c.moveTo(w * 0.33, h * 0.67);
	c.lineTo(w * 0.33, h);
	c.moveTo(w * 0.67, h * 0.33);
	c.lineTo(w * 0.67, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxArchiMate3Capability.prototype.cst.CAPABILITY, mxArchiMate3Capability);

//**********************************************************************************************************************************************************
//Course of Action
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Course(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Course, mxShape);

mxArchiMate3Course.prototype.cst = {
		COURSE : 'mxgraph.archimate3.course'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Course.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Course.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, h);
	c.arcTo(w * 0.7, h * 0.7, 0, 0, 1, w * 0.41, h * 0.56);
	c.moveTo(w * 0.14, h * 0.54);
	c.lineTo(w * 0.41, h * 0.56);
	c.lineTo(w * 0.3, h * 0.78);
	c.stroke();
	
	c.ellipse(w * 0.4, 0, w * 0.6, h * 0.6);
	c.stroke();
	c.ellipse(w * 0.5, h * 0.1, w * 0.4, h * 0.4);
	c.stroke();
	
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#000000');
	c.setFillColor(fillColor);
	c.ellipse(w * 0.6, h * 0.2, w * 0.2, h * 0.2);
	c.fill();
};

mxCellRenderer.registerShape(mxArchiMate3Course.prototype.cst.COURSE, mxArchiMate3Course);

//**********************************************************************************************************************************************************
//Node
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Node(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Node, mxShape);

mxArchiMate3Node.prototype.cst = {
		NODE : 'mxgraph.archimate3.node'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Node.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Node.prototype.background = function(c, x, y, w, h)
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
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Node.prototype.cst.NODE, mxArchiMate3Node);

mxArchiMate3Node.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.25), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.75), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 1), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 1), false));
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
//Device
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Device(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Device, mxShape);

mxArchiMate3Device.prototype.cst = {
		DEVICE : 'mxgraph.archimate3.device'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Device.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Device.prototype.background = function(c, x, y, w, h)
{
	c.roundrect(0, 0, w, h * 0.88, w * 0.1, h * 0.1);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w * 0.1, h * 0.88);
	c.lineTo(0, h);
	c.lineTo(w, h);
	c.lineTo(w * 0.9, h * 0.88);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3Device.prototype.cst.DEVICE, mxArchiMate3Device);

mxArchiMate3Device.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0.03, 0.03), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.75, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.97, 0.03), false));
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
//System Software
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3SysSw(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3SysSw, mxShape);

mxArchiMate3SysSw.prototype.cst = {
		SYS_SW : 'mxgraph.archimate3.sysSw'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3SysSw.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3SysSw.prototype.background = function(c, x, y, w, h)
{
	c.ellipse(w * 0.3, 0, w * 0.7, h * 0.7);
	c.stroke();
	
	c.ellipse(0, h * 0.02, w * 0.98, h * 0.98);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxArchiMate3SysSw.prototype.cst.SYS_SW, mxArchiMate3SysSw);

//**********************************************************************************************************************************************************
//Artifact
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Artifact(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Artifact, mxShape);

mxArchiMate3Artifact.prototype.cst = {
		ARTIFACT : 'mxgraph.archimate3.artifact'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Artifact.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Artifact.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w * 0.7, 0);
	c.lineTo(w, h * 0.22);
	c.lineTo(w, h);
	c.lineTo(0, h);
	c.close();
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w * 0.7, 0);
	c.lineTo(w * 0.7, h * 0.22);
	c.lineTo(w, h * 0.22);
	c.stroke();
};

mxCellRenderer.registerShape(mxArchiMate3Artifact.prototype.cst.ARTIFACT, mxArchiMate3Artifact);

mxArchiMate3Artifact.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.25, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.5, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.7, 0), false));
	constr.push(new mxConnectionConstraint(new mxPoint(0.85, 0.11), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.22), false));
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
//Communication Network
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3CommNetw(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3CommNetw, mxShape);

mxArchiMate3CommNetw.prototype.cst = {
		COMM_NETW : 'mxgraph.archimate3.commNetw'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3CommNetw.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3CommNetw.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w * 0.2, h);
	c.lineTo(0, h * 0.5);
	c.lineTo(w * 0.2, 0);
	c.moveTo(w * 0.8, h);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.8, 0);
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.stroke();
};

mxCellRenderer.registerShape(mxArchiMate3CommNetw.prototype.cst.COMM_NETW, mxArchiMate3CommNetw);

mxArchiMate3CommNetw.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));

	return (constr);
};

//**********************************************************************************************************************************************************
//Path
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxArchiMate3Path(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxArchiMate3Path, mxShape);

mxArchiMate3Path.prototype.cst = {
		PATH : 'mxgraph.archimate3.path'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxArchiMate3Path.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, 0, 0, w, h);
	c.setShadow(false);
};

mxArchiMate3Path.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(w * 0.2, h);
	c.lineTo(0, h * 0.5);
	c.lineTo(w * 0.2, 0);
	c.moveTo(w * 0.8, h);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.8, 0);
	c.stroke();
	
	c.setDashed(true);
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.stroke();
};

mxCellRenderer.registerShape(mxArchiMate3Path.prototype.cst.PATH, mxArchiMate3Path);

mxArchiMate3Path.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0.5), false));
	constr.push(new mxConnectionConstraint(new mxPoint(1, 0.5), false));

	return (constr);
};
