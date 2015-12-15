/* */ 
'use strict';
var __decorate = (this && this.__decorate) || function(decorators, target, key, desc) {
  var c = arguments.length,
      r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
      d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if (d = decorators[i])
        r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
    return Reflect.metadata(k, v);
};
var api_1 = require('../../core/render/api');
var client_message_broker_1 = require('../shared/client_message_broker');
var lang_1 = require('../../facade/lang');
var di_1 = require('../../core/di');
var render_proto_view_ref_store_1 = require('../shared/render_proto_view_ref_store');
var render_view_with_fragments_store_1 = require('../shared/render_view_with_fragments_store');
var api_2 = require('../shared/api');
var messaging_api_1 = require('../shared/messaging_api');
var event_dispatcher_1 = require('./event_dispatcher');
var WebWorkerRenderer = (function() {
  function WebWorkerRenderer(messageBrokerFactory, _renderProtoViewRefStore, _renderViewStore, _eventDispatcher) {
    this._renderProtoViewRefStore = _renderProtoViewRefStore;
    this._renderViewStore = _renderViewStore;
    this._eventDispatcher = _eventDispatcher;
    this._messageBroker = messageBrokerFactory.createMessageBroker(messaging_api_1.RENDERER_CHANNEL);
  }
  WebWorkerRenderer.prototype.registerComponentTemplate = function(template) {
    var fnArgs = [new client_message_broker_1.FnArg(template, api_1.RenderComponentTemplate)];
    var args = new client_message_broker_1.UiArguments("registerComponentTemplate", fnArgs);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer.prototype.createProtoView = function(componentTemplateId, cmds) {
    var renderProtoViewRef = this._renderProtoViewRefStore.allocate();
    var fnArgs = [new client_message_broker_1.FnArg(componentTemplateId, null), new client_message_broker_1.FnArg(cmds, api_2.WebWorkerTemplateCmd), new client_message_broker_1.FnArg(renderProtoViewRef, api_1.RenderProtoViewRef)];
    var args = new client_message_broker_1.UiArguments("createProtoView", fnArgs);
    this._messageBroker.runOnService(args, null);
    return renderProtoViewRef;
  };
  WebWorkerRenderer.prototype.createRootHostView = function(hostProtoViewRef, fragmentCount, hostElementSelector) {
    return this._createViewHelper(hostProtoViewRef, fragmentCount, hostElementSelector);
  };
  WebWorkerRenderer.prototype.createView = function(protoViewRef, fragmentCount) {
    return this._createViewHelper(protoViewRef, fragmentCount);
  };
  WebWorkerRenderer.prototype._createViewHelper = function(protoViewRef, fragmentCount, hostElementSelector) {
    var renderViewWithFragments = this._renderViewStore.allocate(fragmentCount);
    var startIndex = (renderViewWithFragments.viewRef).refNumber;
    var fnArgs = [new client_message_broker_1.FnArg(protoViewRef, api_1.RenderProtoViewRef), new client_message_broker_1.FnArg(fragmentCount, null)];
    var method = "createView";
    if (lang_1.isPresent(hostElementSelector) && hostElementSelector != null) {
      fnArgs.push(new client_message_broker_1.FnArg(hostElementSelector, null));
      method = "createRootHostView";
    }
    fnArgs.push(new client_message_broker_1.FnArg(startIndex, null));
    var args = new client_message_broker_1.UiArguments(method, fnArgs);
    this._messageBroker.runOnService(args, null);
    return renderViewWithFragments;
  };
  WebWorkerRenderer.prototype.destroyView = function(viewRef) {
    var fnArgs = [new client_message_broker_1.FnArg(viewRef, api_1.RenderViewRef)];
    var args = new client_message_broker_1.UiArguments("destroyView", fnArgs);
    this._messageBroker.runOnService(args, null);
    this._renderViewStore.remove(viewRef);
  };
  WebWorkerRenderer.prototype.attachFragmentAfterFragment = function(previousFragmentRef, fragmentRef) {
    var fnArgs = [new client_message_broker_1.FnArg(previousFragmentRef, api_1.RenderFragmentRef), new client_message_broker_1.FnArg(fragmentRef, api_1.RenderFragmentRef)];
    var args = new client_message_broker_1.UiArguments("attachFragmentAfterFragment", fnArgs);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer.prototype.attachFragmentAfterElement = function(elementRef, fragmentRef) {
    var fnArgs = [new client_message_broker_1.FnArg(elementRef, api_2.WebWorkerElementRef), new client_message_broker_1.FnArg(fragmentRef, api_1.RenderFragmentRef)];
    var args = new client_message_broker_1.UiArguments("attachFragmentAfterElement", fnArgs);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer.prototype.detachFragment = function(fragmentRef) {
    var fnArgs = [new client_message_broker_1.FnArg(fragmentRef, api_1.RenderFragmentRef)];
    var args = new client_message_broker_1.UiArguments("detachFragment", fnArgs);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer.prototype.hydrateView = function(viewRef) {
    var fnArgs = [new client_message_broker_1.FnArg(viewRef, api_1.RenderViewRef)];
    var args = new client_message_broker_1.UiArguments("hydrateView", fnArgs);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer.prototype.dehydrateView = function(viewRef) {
    var fnArgs = [new client_message_broker_1.FnArg(viewRef, api_1.RenderViewRef)];
    var args = new client_message_broker_1.UiArguments("dehydrateView", fnArgs);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer.prototype.getNativeElementSync = function(location) {
    return null;
  };
  WebWorkerRenderer.prototype.setElementProperty = function(location, propertyName, propertyValue) {
    var fnArgs = [new client_message_broker_1.FnArg(location, api_2.WebWorkerElementRef), new client_message_broker_1.FnArg(propertyName, null), new client_message_broker_1.FnArg(propertyValue, null)];
    var args = new client_message_broker_1.UiArguments("setElementProperty", fnArgs);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer.prototype.setElementAttribute = function(location, attributeName, attributeValue) {
    var fnArgs = [new client_message_broker_1.FnArg(location, api_2.WebWorkerElementRef), new client_message_broker_1.FnArg(attributeName, null), new client_message_broker_1.FnArg(attributeValue, null)];
    var args = new client_message_broker_1.UiArguments("setElementAttribute", fnArgs);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer.prototype.setBindingDebugInfo = function(location, propertyName, propertyValue) {
    var fnArgs = [new client_message_broker_1.FnArg(location, api_2.WebWorkerElementRef), new client_message_broker_1.FnArg(propertyName, null), new client_message_broker_1.FnArg(propertyValue, null)];
    var args = new client_message_broker_1.UiArguments("setBindingDebugInfo", fnArgs);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer.prototype.setElementClass = function(location, className, isAdd) {
    var fnArgs = [new client_message_broker_1.FnArg(location, api_2.WebWorkerElementRef), new client_message_broker_1.FnArg(className, null), new client_message_broker_1.FnArg(isAdd, null)];
    var args = new client_message_broker_1.UiArguments("setElementClass", fnArgs);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer.prototype.setElementStyle = function(location, styleName, styleValue) {
    var fnArgs = [new client_message_broker_1.FnArg(location, api_2.WebWorkerElementRef), new client_message_broker_1.FnArg(styleName, null), new client_message_broker_1.FnArg(styleValue, null)];
    var args = new client_message_broker_1.UiArguments("setElementStyle", fnArgs);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer.prototype.invokeElementMethod = function(location, methodName, args) {
    var fnArgs = [new client_message_broker_1.FnArg(location, api_2.WebWorkerElementRef), new client_message_broker_1.FnArg(methodName, null), new client_message_broker_1.FnArg(args, null)];
    var uiArgs = new client_message_broker_1.UiArguments("invokeElementMethod", fnArgs);
    this._messageBroker.runOnService(uiArgs, null);
  };
  WebWorkerRenderer.prototype.setText = function(viewRef, textNodeIndex, text) {
    var fnArgs = [new client_message_broker_1.FnArg(viewRef, api_1.RenderViewRef), new client_message_broker_1.FnArg(textNodeIndex, null), new client_message_broker_1.FnArg(text, null)];
    var args = new client_message_broker_1.UiArguments("setText", fnArgs);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer.prototype.setEventDispatcher = function(viewRef, dispatcher) {
    var fnArgs = [new client_message_broker_1.FnArg(viewRef, api_1.RenderViewRef)];
    var args = new client_message_broker_1.UiArguments("setEventDispatcher", fnArgs);
    this._eventDispatcher.registerEventDispatcher(viewRef, dispatcher);
    this._messageBroker.runOnService(args, null);
  };
  WebWorkerRenderer = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [client_message_broker_1.ClientMessageBrokerFactory, render_proto_view_ref_store_1.RenderProtoViewRefStore, render_view_with_fragments_store_1.RenderViewWithFragmentsStore, event_dispatcher_1.WebWorkerEventDispatcher])], WebWorkerRenderer);
  return WebWorkerRenderer;
})();
exports.WebWorkerRenderer = WebWorkerRenderer;
