import $ from 'jquery';

const plugin = {};
plugin.dirname = `${__dirname}/`;
plugin.repository = 'https://algenty.github.io/flowcharting-repository/';
plugin.mxBasePath = `${plugin.dirname}libs/mxgraph/javascript/dist/`;
plugin.mxImagePath = `${plugin.mxBasePath}images/`;
plugin.partialPath = `${plugin.dirname}/partials/`;
plugin.data = {};

$.ajaxSetup({
  async: false,
});

$.getJSON(`${plugin.dirname}/plugin.json`, (data) => {
  plugin.data = data;
});

plugin.getRootPath = function () {
  return this.dirname;
};

plugin.getLibsPath = function () {
  return `${this.dirname}/libs`;
};

plugin.getShapesPath = function () {
  return `${this.dirname}libs/shapes`;
};

plugin.getMxBasePath = function () {
  return this.mxBasePath;
};

plugin.getMxImagePath = function () {
  return this.mxImagePath;
};

plugin.getName = function () {
  return this.data.id;
};

plugin.getPartialPath = function () {
  return this.partialPath;
};

// eslint-disable-next-line func-names
plugin.popover = function (text, tagBook, tagImage) {
  const url = this.repository;
  const images = `${this.repository}images/`;
  const textEncoded = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const desc = `${textEncoded}`;
  let book = '';
  let image = '';
  if (tagBook) book = `<a href="${url}${tagBook}" target="_blank"><i class="fa fa-book fa-fw"></i>Help</a>`;
  if (tagImage) image = `<a href="${images}${tagImage}.png" target="_blank"><i class="fa fa-image fa-fw"></i>Example</a>`;
  return `
  <div id="popover" style="display:flex;flex-wrap:wrap;width: 100%;">
    <div style="flex:1;height:100px;margin-bottom: 20px;">${desc}</div>
    <div style="flex:1;height:100px;margin-bottom: 20px;">${book}</div>
    <div style="flex-basis: 100%;height:100px;margin-bottom:20px;">${image}</div>
  </div>`;
};

plugin.logLevel = 1;
plugin.logDisplay = false;

window.GF_PLUGIN = window.GF_PLUGIN || plugin;

export default plugin;
