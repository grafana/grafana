# Angular Drag and Drop
**A Native ( without jquery ) Drag and Drop directive for AngularJS using HTML5 Drag and Drop**

---

##ui-draggable(expression)

Directive in module ang-drag-drop (since 1.0.5 - old module name ngDragDrop)

The ui-draggable attribute tells Angular that the element is draggable. ui-draggable takes an expression as the attribute value. The expression should evaluate to either true or false. You can toggle the draggability of an element using this expression.

###Additional Attributes

####_**drag**_(variable)

The class used to mark child elements of draggable object to be used as drag handle. Default class name is `drag-handle`

**NOTE**: If attribute is not present drag handle feature is not active.



####_**drag-handle-class**_(string)

The `drag` property is used to assign the data that needs to be passed along with the dragging element.




####_**on-drop-success**_(function)

The `on-drop-success` attribute takes a function. We can consider this to be an on-drop-success handler function. This can be useful if you need to do some post processing after the dragged element is dropped successfully on the drop site.

**NOTE**: This callback function is only called when the drop succeeds.
You can request the `drag-end` event ( very similiar to requesting the click event in `ng-click` ) by passing `$event` in the event handler.



####_**on-drop-failure**_(function)

The `on-drop-failure` attribute takes a function. We can consider this to be an on-drop-failure handler function. This can be useful if you need to do some post processing after the dragged element is dropped unsuccessfully on any drop site.

**NOTE**: This callback function is only called when the drop fails.
You can request the `drag-end` event ( very similiar to requesting the click event in `ng-click` ) by passing `$event` in the event handler.



####_**drag-channel**_(string)

The `on-drop-failure` attribute takes a function. We can consider this to be an on-drop-failure handler function. This can be useful if you need to do some post processing after the dragged element is dropped unsuccessfully on any drop site.

**NOTE**: This callback function is only called when the drop fails.
You can request the `drag-end` event ( very similiar to requesting the click event in `ng-click` ) by passing `$event` in the event handler.



###Usage



###Events

On start of dragging an Angular Event `ANGULAR_DRAG_START` is dispatched from the `$rootScope`. The event also carries carries the information about the channel in which the dragging has started.

On end of dragging an Angular Event `ANGULAR_DRAG_END` is dispatched from the `$rootScope`. The event also carries carries the information about the channel in which the dragging has started.

When hovering a draggable element on top of a drop area an Angular Event `ANGULAR_HOVER` is dispatched from the `$rootScope`. The event also carries the information about the channel in which the dragging has started.

---

##ui-on-drop(expression)

Directive in module ang-drag-drop (since 1.0.5 - old module name ngDragDrop)

The `ui-on-drop` attribute tells Angular that the element is a drop site. `ui-on-drop` takes a function as the attribute value. The function will be called when a valid dragged element is dropped in that location. A valid dragged element is one which has the same channel as the drop location.

**NOTE** : This callback function is only called when the drop succeeds.
The `ui-on-drop` callback can request additional parameters. The data that is dragged is available to the callback as $data and its channel as `$channel`. Apart from this the drop event is exposed as `$event`.

###Additional Attributes

####_**drop-channel**_(variable)

The channel that the drop site accepts. The dragged element should have the same channel as this drop site for it to be droppable at this location. It is possible to provide comma separated list of channels.

**NOTE**: Also special value of `drag-channel` attribute is available to accept dragged element with any channel value — *



####_**drop-validate**_(function)

Extra validation that makes sure that the drop site accepts the dragged element beyond having the same channel. If not defined, no extra validation is made.

**NOTE**: This callback function is called only if the channel condition is met, when the element starts being dragged




####_**drag-enter-class**_(string)

The class that will be added to the the droppable element when a dragged element ( which is droppable ) enters the drop location. The default value for this is `on-drag-enter`



####_**drag-hover-class**_(string)

The class that will be added to the drop area element when hovering with an element. The default value for this is `on-drag-hover`



###Usage



###Events

On start of dragging an Angular Event `ANGULAR_DRAG_START` is dispatched from the `$rootScope`. The event also carries carries the information about the channel in which the dragging has started.

On end of dragging an Angular Event `ANGULAR_DRAG_END` is dispatched from the `$rootScope`. The event also carries carries the information about the channel in which the dragging has started.

When hovering a draggable element on top of a drop area an Angular Event `ANGULAR_HOVER` is dispatched from the `$rootScope`. The event also carries the information about the channel in which the dragging has started.