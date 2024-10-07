/**
 * $Id: mxAtlassian.js,v 1.0 2018/24/05 12:32:06 mate Exp $
 * Copyright (c) 2006-2018, JGraph Ltd
 */
//**********************************************************************************************************************************************************
// Issue
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxAtlassianJiraIssue(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.dx = 0.5;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxAtlassianJiraIssue, mxRectangleShape);

mxAtlassianJiraIssue.prototype.customProperties = [
	{name: 'issueType', dispName: 'Issue Type', type: 'enum', 
		enumList: [{val: 'story', dispName: 'Story'}, 
				   {val: 'task', dispName: 'Task'}, 
				   {val: 'subTask', dispName: 'Sub-Task'}, 
				   {val: 'feature', dispName: 'Feature'}, 
				   {val: 'bug', dispName: 'Bug'}, 
				   {val: 'techTask', dispName: 'Tech Task'}, 
				   {val: 'epic', dispName: 'Epic'}, 
				   {val: 'improvement', dispName: 'Improvement'}, 
				   {val: 'fault', dispName: 'Fault'}, 
				   {val: 'change', dispName: 'Change'}, 
				   {val: 'access', dispName: 'Access'}, 
				   {val: 'purchase', dispName: 'Purchase'}, 
				   {val: 'itHelp', dispName: 'IT Help'}] 
	},
	{name: 'issuePriority', dispName: 'Issue Priority', type: 'enum', 
		enumList: [{val: 'blocker', dispName: 'Blocker'}, 
				   {val: 'critical', dispName: 'Critical'}, 
				   {val: 'major', dispName: 'Major'}, 
				   {val: 'minor', dispName: 'Minor'}, 
				   {val: 'trivial', dispName: 'Trivial'}] 
	},
	{name: 'issueStatus', dispName: 'Issue Status', type: 'enum', 
		enumList: [{val: 'todo', dispName: 'TODO'}, 
				   {val: 'inProgress', dispName: 'In Progress'}, 
				   {val: 'inReview', dispName: 'In Review'}, 
				   {val: 'done', dispName: 'Done'}] 
	}
];

mxAtlassianJiraIssue.prototype.cst = {ISSUE : 'mxgraph.atlassian.issue'};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxAtlassianJiraIssue.prototype.paintForeground = function(c, x, y, w, h)
{
	c.translate(x, y);

	var issueType = mxUtils.getValue(this.style, 'issueType', 'task');
	var issuePriority = mxUtils.getValue(this.style, 'issuePriority', 'minor');
	var issueStatus = mxUtils.getValue(this.style, 'issueStatus', 'todo');

	c.setStrokeColor('none');
	
	switch (issueType) {
		case 'story':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.story');
			
			if (stencil != null)
			{
				c.setFillColor('#61B659');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
		case 'task':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.task');
			
			if (stencil != null)
			{
				c.setFillColor('#5EA3E4');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
		case 'subTask':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.subtask');
			
			if (stencil != null)
			{
				c.setFillColor('#5EA3E4');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
		case 'feature':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.new_feature');
			
			if (stencil != null)
			{
				c.setFillColor('#61B659');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
		case 'bug':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.bug');
			
			if (stencil != null)
			{
				c.setFillColor('#CE0000');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
		case 'techTask':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.tech_task');
			
			if (stencil != null)
			{
				c.setFillColor('#999C95');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
		case 'epic':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.epic');
			
			if (stencil != null)
			{
				c.setFillColor('#9E4ADD');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
		case 'improvement':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.improvement');
			
			if (stencil != null)
			{
				c.setFillColor('#61B659');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
		case 'fault':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.fault');
			
			if (stencil != null)
			{
				c.setFillColor('#F8902F');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
		case 'change':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.change');
			
			if (stencil != null)
			{
				c.setFillColor('#9E4ADD');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
		case 'access':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.access');
			
			if (stencil != null)
			{
				c.setFillColor('#F8902F');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
		case 'purchase':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.purchase');
			
			if (stencil != null)
			{
				c.setFillColor('#61B659');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
		case 'itHelp':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.it_help');
			
			if (stencil != null)
			{
				c.setFillColor('#5EA3E4');
				stencil.drawShape(c, this, 5, 5, 10, 10);
			}
			
			break;
	}

	switch (issuePriority) {
		case 'blocker':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.no');
			
			if (stencil != null)
			{
				c.setFillColor('#CE0000');
				stencil.drawShape(c, this, 85, 5, 10, 10);
			}
			break;
		case 'critical':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.critical');
			
			if (stencil != null)
			{
				c.setFillColor('#CE0000');
				stencil.drawShape(c, this, 86, 3, 8, 14);
			}
			break;
		case 'major':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.double_up');
			
			if (stencil != null)
			{
				c.setFillColor('#CE0000');
				stencil.drawShape(c, this, 85, 5, 10, 10);
			}
			break;
		case 'minor':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.double');
			
			if (stencil != null)
			{
				c.setFillColor('#2A8735');
				stencil.drawShape(c, this, 85, 5, 10, 10);
			}
			break;
		case 'trivial':
			var stencil = mxStencilRegistry.getStencil('mxgraph.atlassian.single');
			
			if (stencil != null)
			{
				c.setFillColor('#9AA1B2');
				stencil.drawShape(c, this, 85, 5, 10, 10);
			}
			break;
	}

	c.setFillColor('#FFFFFD');
	c.setFontColor('#4E6B89');
	
	switch (issueStatus) {
		case 'todo':
			c.rect(w - 45, 5, 40, 20);
			c.fill();
			
			c.text(w - 25, 15, 0, 0, 'TO DO', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
			break;
		case 'inProgress':
			c.rect(w - 85, 5, 80, 20);
			c.fill();
			
			c.text(w - 45, 15, 0, 0, 'IN PROGRESS', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
			break;
		case 'inReview':
			c.rect(w - 75, 5, 70, 20);
			c.fill();
			
			c.text(w - 40, 15, 0, 0, 'IN REVIEW', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
			break;
		case 'done':
			c.rect(w - 45, 5, 40, 20);
			c.fill();
			
			c.text(w - 25, 15, 0, 0, 'DONE', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
			break;
	    default:
	    	var tw = mxUtils.getValue(this.style, 'issueStatusWidth', issueStatus.length * 6.5);
			c.rect(w - tw - 5, 5, tw, 20);
			c.fill();
	    	c.text(w - 7, 15, 0, 0, issueStatus, mxConstants.ALIGN_RIGHT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
};

mxCellRenderer.registerShape(mxAtlassianJiraIssue.prototype.cst.ISSUE, mxAtlassianJiraIssue);
