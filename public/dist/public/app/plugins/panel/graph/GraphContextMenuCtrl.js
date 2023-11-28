export class GraphContextMenuCtrl {
    constructor($scope) {
        this.scrollContextElement = null;
        this.position = { x: 0, y: 0 };
        this.onClose = () => {
            if (this.scrollContextElement) {
                this.scrollContextElement.removeEventListener('scroll', this.onClose);
            }
            this.scope.$apply(() => {
                this.isVisible = false;
            });
        };
        this.toggleMenu = (event) => {
            this.isVisible = !this.isVisible;
            if (this.isVisible && this.scrollContextElement) {
                this.scrollContextElement.addEventListener('scroll', this.onClose);
            }
            if (this.source) {
                this.position = {
                    x: this.source.pageX,
                    y: this.source.pageY,
                };
            }
            else {
                this.position = {
                    x: event ? event.pageX : 0,
                    y: event ? event.pageY : 0,
                };
            }
        };
        // Sets element which is considered as a scroll context of given context menu.
        // Having access to this element allows scroll event attachement for menu to be closed when user scrolls
        this.setScrollContextElement = (el) => {
            this.scrollContextElement = el;
        };
        this.setSource = (source) => {
            this.source = source;
        };
        this.getSource = () => {
            return this.source;
        };
        this.setMenuItemsSupplier = (menuItemsSupplier) => {
            this.menuItemsSupplier = menuItemsSupplier;
        };
        this.isVisible = false;
        this.scope = $scope;
    }
}
//# sourceMappingURL=GraphContextMenuCtrl.js.map