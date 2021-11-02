var GraphContextMenuCtrl = /** @class */ (function () {
    function GraphContextMenuCtrl($scope) {
        var _this = this;
        this.scrollContextElement = null;
        this.position = { x: 0, y: 0 };
        this.onClose = function () {
            if (_this.scrollContextElement) {
                _this.scrollContextElement.removeEventListener('scroll', _this.onClose);
            }
            _this.scope.$apply(function () {
                _this.isVisible = false;
            });
        };
        this.toggleMenu = function (event) {
            _this.isVisible = !_this.isVisible;
            if (_this.isVisible && _this.scrollContextElement) {
                _this.scrollContextElement.addEventListener('scroll', _this.onClose);
            }
            if (_this.source) {
                _this.position = {
                    x: _this.source.pageX,
                    y: _this.source.pageY,
                };
            }
            else {
                _this.position = {
                    x: event ? event.pageX : 0,
                    y: event ? event.pageY : 0,
                };
            }
        };
        // Sets element which is considered as a scroll context of given context menu.
        // Having access to this element allows scroll event attachement for menu to be closed when user scrolls
        this.setScrollContextElement = function (el) {
            _this.scrollContextElement = el;
        };
        this.setSource = function (source) {
            _this.source = source;
        };
        this.getSource = function () {
            return _this.source;
        };
        this.setMenuItemsSupplier = function (menuItemsSupplier) {
            _this.menuItemsSupplier = menuItemsSupplier;
        };
        this.isVisible = false;
        this.scope = $scope;
    }
    return GraphContextMenuCtrl;
}());
export { GraphContextMenuCtrl };
//# sourceMappingURL=GraphContextMenuCtrl.js.map