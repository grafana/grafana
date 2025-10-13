/* ===================================================
 * bootstrap-transition.js v2.3.2
 * http://getbootstrap.com/2.3.2/javascript.html#transitions
 * ===================================================
 * Copyright 2013 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */


!function($) {

  "use strict"; // jshint ;_;


  /* CSS TRANSITION SUPPORT (http://www.modernizr.com/)
   * ======================================================= */

  $(function() {

    $.support.transition = (function() {

      var transitionEnd = (function() {

        var el = document.createElement('bootstrap')
          , transEndEventNames = {
            'WebkitTransition': 'webkitTransitionEnd'
            , 'MozTransition': 'transitionend'
            , 'OTransition': 'oTransitionEnd otransitionend'
            , 'transition': 'transitionend'
          }
          , name

        for (name in transEndEventNames) {
          if (el.style[name] !== undefined) {
            return transEndEventNames[name]
          }
        }

      }())

      return transitionEnd && {
        end: transitionEnd
      }

    })()

  })

}(window.jQuery);/* ==========================================================
 * bootstrap-alert.js v2.3.2
 * http://getbootstrap.com/2.3.2/javascript.html#alerts
 * ==========================================================
 * Copyright 2013 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */


!function($) {

  "use strict"; // jshint ;_;

  /* ============================================================
   * bootstrap-dropdown.js v2.3.2
   * http://getbootstrap.com/2.3.2/javascript.html#dropdowns
   * ============================================================
   * Copyright 2013 Twitter, Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * ============================================================ */


  /* DROPDOWN CLASS DEFINITION
   * ========================= */

  var toggle = '[data-toggle=dropdown]'
    , Dropdown = function(element) {
      var $el = $(element).on('click.dropdown.data-api', this.toggle)
      $('html').on('click.dropdown.data-api', function() {
        $el.parent().removeClass('open')
      })
    }

  Dropdown.prototype = {

    constructor: Dropdown

    , toggle: function(e) {
      var $this = $(this)
        , $parent
        , isActive

      if ($this.is('.disabled, :disabled')) return

      $parent = getParent($this)

      isActive = $parent.hasClass('open')

      clearMenus()

      if (!isActive) {
        if ('ontouchstart' in document.documentElement) {
          // if mobile we we use a backdrop because click events don't delegate
          $('<div class="dropdown-backdrop"/>').insertBefore($(this)).on('click', clearMenus)
        }
        $parent.toggleClass('open')
      }

      $this.focus()

      return false
    }

    , keydown: function(e) {
      var $this
        , $items
        , $active
        , $parent
        , isActive
        , index

      if (!/(38|40|27)/.test(e.keyCode)) return

      $this = $(this)

      e.preventDefault()
      e.stopPropagation()

      if ($this.is('.disabled, :disabled')) return

      $parent = getParent($this)

      isActive = $parent.hasClass('open')

      if (!isActive || (isActive && e.keyCode == 27)) {
        if (e.which == 27) $parent.find(toggle).focus()
        return $this.click()
      }

      $items = $('[role=menu] li:not(.divider):visible a', $parent)

      if (!$items.length) return

      index = $items.index($items.filter(':focus'))

      if (e.keyCode == 38 && index > 0) index--                                        // up
      if (e.keyCode == 40 && index < $items.length - 1) index++                        // down
      if (!~index) index = 0

      $items
        .eq(index)
        .focus()
    }

  }

  function clearMenus() {
    $('.dropdown-backdrop').remove()
    $(toggle).each(function() {
      getParent($(this)).removeClass('open')
    })
  }

  function getParent($this) {
    var selector = $this.attr('data-target')
      , $parent

    if (!selector) {
      selector = $this.attr('href')
      // grafana backport fix from bootstrap 3
      selector = selector && /#[A-Za-z]/.test(selector) && selector.replace(/.*(?=#[^\s]*$)/, '') //strip for ie7
    }

    $parent = selector && $.find(selector)

    if (!$parent || !$parent.length) $parent = $this.parent()

    return $parent
  }


  /* DROPDOWN PLUGIN DEFINITION
   * ========================== */

  var old = $.fn.dropdown

  $.fn.dropdown = function(option) {
    return this.each(function() {
      var $this = $(this)
        , data = $this.data('dropdown')
      if (!data) $this.data('dropdown', (data = new Dropdown(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  $.fn.dropdown.Constructor = Dropdown


  /* DROPDOWN NO CONFLICT
   * ==================== */

  $.fn.dropdown.noConflict = function() {
    $.fn.dropdown = old
    return this
  }


  /* APPLY TO STANDARD DROPDOWN ELEMENTS
   * =================================== */

  $(document)
    .on('click.dropdown.data-api', clearMenus)
    .on('click.dropdown.data-api', '.dropdown form', function(e) { e.stopPropagation() })
    .on('click.dropdown.data-api', toggle, Dropdown.prototype.toggle)
    .on('keydown.dropdown.data-api', toggle + ', [role=menu]', Dropdown.prototype.keydown)

}(window.jQuery);
/* =========================================================
 * bootstrap-modal.js v2.3.2
 * http://getbootstrap.com/2.3.2/javascript.html#modals
 * =========================================================
 * Copyright 2013 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================= */


!function($) {

  "use strict"; // jshint ;_;


  /* MODAL CLASS DEFINITION
   * ====================== */

  var Modal = function(element, options) {
    this.options = options
    this.$element = $(element)
      .delegate('[data-dismiss="modal"]', 'click.dismiss.modal', $.proxy(this.hide, this))
    this.options.remote && this.$element.find('.modal-body').load(this.options.remote)
  }

  Modal.prototype = {

    constructor: Modal

    , toggle: function() {
      return this[!this.isShown ? 'show' : 'hide']()
    }

    , show: function() {
      var that = this
        , e = $.Event('show')

      this.$element.trigger(e)

      if (this.isShown || e.isDefaultPrevented()) return

      this.isShown = true

      this.escape()

      this.backdrop(function() {
        var transition = $.support.transition && that.$element.hasClass('fade')

        if (!that.$element.parent().length) {
          that.$element.appendTo(document.body) //don't move modals dom position
        }

        that.$element.show()

        if (transition) {
          that.$element[0].offsetWidth // force reflow
        }

        that.$element
          .addClass('in')
          .attr('aria-hidden', false)

        that.enforceFocus()

        transition ?
          that.$element.one($.support.transition.end, function() { that.$element.focus().trigger('shown') }) :
          that.$element.focus().trigger('shown')

      })
    }

    , hide: function(e) {
      e && e.preventDefault()

      var that = this

      e = $.Event('hide')

      this.$element.trigger(e)

      if (!this.isShown || e.isDefaultPrevented()) return

      this.isShown = false

      this.escape()

      $(document).off('focusin.modal')

      this.$element
        .removeClass('in')
        .attr('aria-hidden', true)

      $.support.transition && this.$element.hasClass('fade') ?
        this.hideWithTransition() :
        this.hideModal()
    }

    , enforceFocus: function() {
      var that = this
      $(document).on('focusin.modal', function(e) {
        if (that.$element[0] !== e.target && !that.$element.has(e.target).length) {
          that.$element.focus()
        }
      })
    }

    , escape: function() {
      var that = this
      if (this.isShown && this.options.keyboard) {
        this.$element.on('keyup.dismiss.modal', function(e) {
          e.which == 27 && that.hide()
        })
      } else if (!this.isShown) {
        this.$element.off('keyup.dismiss.modal')
      }
    }

    , hideWithTransition: function() {
      var that = this
        , timeout = setTimeout(function() {
          that.$element.off($.support.transition.end)
          that.hideModal()
        }, 500)

      this.$element.one($.support.transition.end, function() {
        clearTimeout(timeout)
        that.hideModal()
      })
    }

    , hideModal: function() {
      var that = this
      this.$element.hide()
      this.backdrop(function() {
        that.removeBackdrop()
        that.$element.trigger('hidden')
      })
    }

    , removeBackdrop: function() {
      this.$backdrop && this.$backdrop.remove()
      this.$backdrop = null
    }

    , backdrop: function(callback) {
      var that = this
        , animate = this.$element.hasClass('fade') ? 'fade' : ''

      if (this.isShown && this.options.backdrop) {
        var doAnimate = $.support.transition && animate

        this.$backdrop = $('<div class="modal-backdrop ' + animate + '" />')
          .appendTo(document.body)

        this.$backdrop.click(
          this.options.backdrop == 'static' ?
            $.proxy(this.$element[0].focus, this.$element[0])
            : $.proxy(this.hide, this)
        )

        if (doAnimate) this.$backdrop[0].offsetWidth // force reflow

        this.$backdrop.addClass('in')

        if (!callback) return

        doAnimate ?
          this.$backdrop.one($.support.transition.end, callback) :
          callback()

      } else if (!this.isShown && this.$backdrop) {
        this.$backdrop.removeClass('in')

        $.support.transition && this.$element.hasClass('fade') ?
          this.$backdrop.one($.support.transition.end, callback) :
          callback()

      } else if (callback) {
        callback()
      }
    }
  }


  /* MODAL PLUGIN DEFINITION
   * ======================= */

  var old = $.fn.modal

  $.fn.modal = function(option) {
    return this.each(function() {
      var $this = $(this)
        , data = $this.data('modal')
        , options = $.extend({}, $.fn.modal.defaults, $this.data(), typeof option == 'object' && option)
      if (!data) $this.data('modal', (data = new Modal(this, options)))
      if (typeof option == 'string') data[option]()
      else if (options.show) data.show()
    })
  }

  $.fn.modal.defaults = {
    backdrop: true
    , keyboard: true
    , show: true
  }

  $.fn.modal.Constructor = Modal


  /* MODAL NO CONFLICT
   * ================= */

  $.fn.modal.noConflict = function() {
    $.fn.modal = old
    return this
  }


  /* MODAL DATA-API
   * ============== */

  $(document).on('click.modal.data-api', '[data-toggle="modal"]', function(e) {
    var $this = $(this)
      , href = $this.attr('href')
      , $target = $.find($this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, ''))) //strip for ie7
      , option = $target.data('modal') ? 'toggle' : $.extend({ remote: !/#/.test(href) && href }, $target.data(), $this.data())

    e.preventDefault()

    $target
      .modal(option)
      .one('hide', function() {
        $this.focus()
      })
  })

}(window.jQuery);
/* ===========================================================
 * bootstrap-tooltip.js v2.3.2
 * http://getbootstrap.com/2.3.2/javascript.html#tooltips
 * Inspired by the original jQuery.tipsy by Jason Frame
 * ===========================================================
 * Copyright 2013 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */


!function($) {

  "use strict"; // jshint ;_;


  /* TOOLTIP PUBLIC CLASS DEFINITION
   * =============================== */

  var Tooltip = function(element, options) {
    this.init('tooltip', element, options)
  }

  Tooltip.prototype = {

    constructor: Tooltip

    , init: function(type, element, options) {
      var eventIn
        , eventOut
        , triggers
        , trigger
        , i

      this.type = type
      this.$element = $(element)
      this.options = this.getOptions(options)
      this.enabled = true

      triggers = this.options.trigger.split(' ')

      for (i = triggers.length; i--;) {
        trigger = triggers[i]
        if (trigger == 'click') {
          this.$element.on('click.' + this.type, this.options.selector, $.proxy(this.toggle, this))
        } else if (trigger != 'manual') {
          eventIn = trigger == 'hover' ? 'mouseenter' : 'focus'
          eventOut = trigger == 'hover' ? 'mouseleave' : 'blur'
          this.$element.on(eventIn + '.' + this.type, this.options.selector, $.proxy(this.enter, this))
          this.$element.on(eventOut + '.' + this.type, this.options.selector, $.proxy(this.leave, this))
        }
      }

      this.options.selector ?
        (this._options = $.extend({}, this.options, { trigger: 'manual', selector: '' })) :
        this.fixTitle()
    }

    , getOptions: function(options) {
      options = $.extend({}, $.fn[this.type].defaults, this.$element.data(), options)

      if (options.delay && typeof options.delay == 'number') {
        options.delay = {
          show: options.delay
          , hide: options.delay
        }
      }

      return options
    }

    , enter: function(e) {
      var defaults = $.fn[this.type].defaults
        , options = {}
        , self

      this._options && $.each(this._options, function(key, value) {
        if (defaults[key] != value) options[key] = value
      }, this)

      self = $(e.currentTarget)[this.type](options).data(this.type)

      if (!self.options.delay || !self.options.delay.show) return self.show()

      clearTimeout(this.timeout)
      self.hoverState = 'in'
      this.timeout = setTimeout(function() {
        if (self.hoverState == 'in') self.show()
      }, self.options.delay.show)
    }

    , leave: function(e) {
      var self = $(e.currentTarget)[this.type](this._options).data(this.type)

      if (this.timeout) clearTimeout(this.timeout)
      if (!self.options.delay || !self.options.delay.hide) return self.hide()

      self.hoverState = 'out'
      this.timeout = setTimeout(function() {
        if (self.hoverState == 'out') self.hide()
      }, self.options.delay.hide)
    }

    , show: function() {
      var $tip
        , pos
        , actualWidth
        , actualHeight
        , placement
        , tp
        , e = $.Event('show')

      if (this.hasContent() && this.enabled) {
        this.$element.trigger(e)
        if (e.isDefaultPrevented()) return
        $tip = this.tip()
        this.setContent()

        if (this.options.animation) {
          $tip.addClass('fade')
        }

        placement = typeof this.options.placement == 'function' ?
          this.options.placement.call(this, $tip[0], this.$element[0]) :
          this.options.placement

        $tip
          .detach()
          .css({ top: 0, left: 0, display: 'block' })

        if (this.options.container) {
          $tip.appendTo($.find(this.options.container));
        } else {
          $tip.insertAfter(this.$element)
        }

        pos = this.getPosition()

        actualWidth = $tip[0].offsetWidth
        actualHeight = $tip[0].offsetHeight

        switch (placement) {
          case 'bottom':
            tp = { top: pos.top + pos.height, left: pos.left + pos.width / 2 - actualWidth / 2 }
            break
          case 'top':
            tp = { top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2 }
            break
          case 'left':
            tp = { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth }
            break
          case 'right':
            tp = { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width }
            break

          // extend placements (top)
          case 'topLeft':
            tp = { top: pos.top - actualHeight, left: pos.left + pos.width / 2 - (actualWidth * .10) };
            break;
          case 'topRight':
            tp = { top: pos.top - actualHeight, left: pos.left + pos.width / 2 - (actualWidth * .90) };
            break;

          // extend placements (right)
          case 'rightTop':
            tp = { top: pos.top + pos.height / 2 - (actualHeight * .10), left: pos.left + pos.width };
            break;
          case 'rightBottom':
            tp = { top: pos.top + pos.height / 2 - (actualHeight * .90), left: pos.left + pos.width };
            break;

          // extend placements (bottom)
          case 'bottomLeft':
            tp = { top: pos.top + pos.height, left: pos.left + pos.width / 2 - (actualWidth * .10) };
            break;
          case 'bottomRight':
            tp = { top: pos.top + pos.height, left: pos.left + pos.width / 2 - (actualWidth * .90) };
            break;

          // extend placements (left)
          case 'leftTop':
            tp = { top: pos.top + pos.height / 2 - (actualHeight * .10), left: pos.left - actualWidth };
            break;
          case 'leftBottom':
            tp = { top: pos.top + pos.height / 2 - (actualHeight * .90), left: pos.left - actualWidth };
            break;


        }

        this.applyPlacement(tp, placement)
        this.$element.trigger('shown')
      }
    }

    , applyPlacement: function(offset, placement) {
      var $tip = this.tip()
        , width = $tip[0].offsetWidth
        , height = $tip[0].offsetHeight
        , actualWidth
        , actualHeight
        , delta
        , replace

      $tip
        .offset(offset)
        .addClass(placement)
        .addClass('in')

      actualWidth = $tip[0].offsetWidth
      actualHeight = $tip[0].offsetHeight

      if (placement == 'top' && actualHeight != height) {
        offset.top = offset.top + height - actualHeight
        replace = true
      }

      if (placement == 'bottom' || placement == 'top') {
        delta = 0

        if (offset.left < 0) {
          delta = offset.left * -2
          offset.left = 0
          $tip.offset(offset)
          actualWidth = $tip[0].offsetWidth
          actualHeight = $tip[0].offsetHeight
        }

        this.replaceArrow(delta - width + actualWidth, actualWidth, 'left')
      } else {
        this.replaceArrow(actualHeight - height, actualHeight, 'top')
      }

      if (replace) $tip.offset(offset)
    }

    , replaceArrow: function(delta, dimension, position) {
      this
        .arrow()
        .css(position, delta ? (50 * (1 - delta / dimension) + "%") : '')
    }

    , setContent: function() {
      var $tip = this.tip()
        , title = this.getTitle()

      //$tip.find('.tooltip-inner')[this.options.html ? 'html' : 'text'](title)
      $tip.find('.tooltip-inner').text(title)
      $tip.removeClass('fade in top bottom left right')
    }

    , hide: function() {
      var that = this
        , $tip = this.tip()
        , e = $.Event('hide')

      this.$element.trigger(e)
      if (e.isDefaultPrevented()) return

      $tip.removeClass('in')

      function removeWithAnimation() {
        var timeout = setTimeout(function() {
          $tip.off($.support.transition.end).detach()
        }, 500)

        $tip.one($.support.transition.end, function() {
          clearTimeout(timeout)
          $tip.detach()
        })
      }

      $.support.transition && this.$tip.hasClass('fade') ?
        removeWithAnimation() :
        $tip.detach()

      this.$element.trigger('hidden')

      return this
    }

    , fixTitle: function() {
      var $e = this.$element
      if ($e.attr('title') || typeof ($e.attr('data-original-title')) != 'string') {
        $e.attr('data-original-title', $e.attr('title') || '').attr('title', '')
      }
    }

    , hasContent: function() {
      return this.getTitle()
    }

    , getPosition: function() {
      var el = this.$element[0]
      return $.extend({}, (typeof el.getBoundingClientRect == 'function') ? el.getBoundingClientRect() : {
        width: el.offsetWidth
        , height: el.offsetHeight
      }, this.$element.offset())
    }

    , getTitle: function() {
      var title
        , $e = this.$element
        , o = this.options

      title = $e.attr('data-original-title')
        || (typeof o.title == 'function' ? o.title.call($e[0]) : o.title)

      return title
    }

    , tip: function() {
      return this.$tip = this.$tip || $(this.options.template)
    }

    , arrow: function() {
      return this.$arrow = this.$arrow || this.tip().find(".tooltip-arrow")
    }

    , validate: function() {
      if (!this.$element[0].parentNode) {
        this.hide()
        this.$element = null
        this.options = null
      }
    }

    , enable: function() {
      this.enabled = true
    }

    , disable: function() {
      this.enabled = false
    }

    , toggleEnabled: function() {
      this.enabled = !this.enabled
    }

    , toggle: function(e) {
      var self = e ? $(e.currentTarget)[this.type](this._options).data(this.type) : this
      self.tip().hasClass('in') ? self.hide() : self.show()
    }

    , destroy: function() {
      this.hide().$element.off('.' + this.type).removeData(this.type)
    }

  }


  /* TOOLTIP PLUGIN DEFINITION
   * ========================= */

  var old = $.fn.tooltip

  $.fn.tooltip = function(option) {
    return this.each(function() {
      var $this = $(this)
        , data = $this.data('tooltip')
        , options = typeof option == 'object' && option
      if (!data) $this.data('tooltip', (data = new Tooltip(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  $.fn.tooltip.Constructor = Tooltip

  $.fn.tooltip.defaults = {
    animation: true
    , placement: 'top'
    , selector: false
    , template: '<div class="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>'
    , trigger: 'hover focus'
    , title: ''
    , delay: 0
    , html: false
    , container: false
  }


  /* TOOLTIP NO CONFLICT
   * =================== */

  $.fn.tooltip.noConflict = function() {
    $.fn.tooltip = old
    return this
  }

}(window.jQuery);

/* ========================================================
 * bootstrap-tab.js v2.3.2
 * http://getbootstrap.com/2.3.2/javascript.html#tabs
 * ========================================================
 * Copyright 2013 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ======================================================== */


!function($) {

  "use strict"; // jshint ;_;


  /* TAB CLASS DEFINITION
   * ==================== */

  var Tab = function(element) {
    this.element = $(element)
  }

  Tab.prototype = {

    constructor: Tab

    , show: function() {
      var $this = this.element
        , $ul = $this.closest('ul:not(.dropdown-menu)')
        , selector = $this.attr('data-target')
        , previous
        , $target
        , e

      if (!selector) {
        selector = $this.attr('href')
        selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') //strip for ie7
      }

      if ($this.parent('li').hasClass('active')) return

      previous = $ul.find('.active:last a')[0]

      e = $.Event('show', {
        relatedTarget: previous
      })

      $this.trigger(e)

      if (e.isDefaultPrevented()) return

      $target = $.find(selector)

      this.activate($this.parent('li'), $ul)
      this.activate($target, $target.parent(), function() {
        $this.trigger({
          type: 'shown'
          , relatedTarget: previous
        })
      })
    }

    , activate: function(element, container, callback) {
      var $active = container.find('> .active')
        , transition = callback
          && $.support.transition
          && $active.hasClass('fade')

      function next() {
        $active
          .removeClass('active')
          .find('> .dropdown-menu > .active')
          .removeClass('active')

        element.addClass('active')

        if (transition) {
          element[0].offsetWidth // reflow for transition
          element.addClass('in')
        } else {
          element.removeClass('fade')
        }

        if (element.parent('.dropdown-menu')) {
          element.closest('li.dropdown').addClass('active')
        }

        callback && callback()
      }

      transition ?
        $active.one($.support.transition.end, next) :
        next()

      $active.removeClass('in')
    }
  }


  /* TAB PLUGIN DEFINITION
   * ===================== */

  var old = $.fn.tab

  $.fn.tab = function(option) {
    return this.each(function() {
      var $this = $(this)
        , data = $this.data('tab')
      if (!data) $this.data('tab', (data = new Tab(this)))
      if (typeof option == 'string') data[option]()
    })
  }

  $.fn.tab.Constructor = Tab


  /* TAB NO CONFLICT
   * =============== */

  $.fn.tab.noConflict = function() {
    $.fn.tab = old
    return this
  }


  /* TAB DATA-API
   * ============ */

  $(document).on('click.tab.data-api', '[data-toggle="tab"], [data-toggle="pill"]', function(e) {
    e.preventDefault()
    $(this).tab('show')
  })

}(window.jQuery);/* =============================================================
 * bootstrap-typeahead.js v2.3.2
 * http://getbootstrap.com/2.3.2/javascript.html#typeahead
 * =============================================================
 * Copyright 2013 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ============================================================ */


!function($) {

  "use strict"; // jshint ;_;


  /* TYPEAHEAD PUBLIC CLASS DEFINITION
   * ================================= */

  var Typeahead = function(element, options) {
    this.$element = $(element)
    this.options = $.extend({}, $.fn.typeahead.defaults, options)
    this.matcher = this.options.matcher || this.matcher
    this.sorter = this.options.sorter || this.sorter
    this.highlighter = this.options.highlighter || this.highlighter
    this.updater = this.options.updater || this.updater
    this.source = this.options.source
    this.$menu = $(this.options.menu)
    this.shown = false
    this.listen()
  }

  Typeahead.prototype = {

    constructor: Typeahead

    , select: function() {
      // CHANGE (rashidkpc) If nothing is selected, use existing value
      var val = this.$menu.find('.active').attr('data-value') || this.$element.val();
      this.$element
        .val(this.updater(val))
        .change()
      return this.hide()
    }

    , updater: function(item) {
      return item
    }

    , show: function() {
      var pos = $.extend({}, this.$element.position(), {
        height: this.$element[0].offsetHeight
      })

      this.$menu
        .insertAfter(this.$element)
        .css({
          top: pos.top + pos.height
          , left: pos.left
        })
        .show()

      this.shown = true
      return this
    }

    , hide: function() {
      this.$menu.hide()
      this.shown = false
      return this
    }

    , lookup: function(event) {
      var items

      this.query = this.$element.val()

      if (!this.query || this.query.length < this.options.minLength) {
        return this.shown ? this.hide() : this
      }

      items = $.isFunction(this.source) ? this.source(this.query, $.proxy(this.process, this)) : this.source

      return items ? this.process(items) : this
    }

    , process: function(items) {
      var that = this

      items = $.grep(items, function(item) {
        return that.matcher(item)
      })

      items = this.sorter(items)

      if (!items.length) {
        return this.shown ? this.hide() : this
      }

      return this.render(items.slice(0, this.options.items)).show()
    }

    , matcher: function(item) {
      return ~item.toLowerCase().indexOf(this.query.toLowerCase())
    }

    , sorter: function(items) {
      var beginswith = []
        , caseSensitive = []
        , caseInsensitive = []
        , item

      while (item = items.shift()) {
        if (!item.toLowerCase().indexOf(this.query.toLowerCase())) beginswith.push(item)
        else if (~item.indexOf(this.query)) caseSensitive.push(item)
        else caseInsensitive.push(item)
      }

      return beginswith.concat(caseSensitive, caseInsensitive)
    }

    , highlighter: function(item) {
      var query = this.query.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&')
      if (!query) {
        return item;
      }
      return item.replace(new RegExp('(' + query + ')', 'ig'), function($1, match) {
        return '<strong>' + match + '</strong>'
      });
    }

    , render: function(items) {
      var that = this

      items = $(items).map(function(i, item) {
        i = $(that.options.item).attr('data-value', item)
        i.find('a').html(that.highlighter(item))
        return i[0]
      })

      // CHANGE (rashidpc) Do not select first element by default
      // items.first().addClass('active')
      this.$menu.html(items)
      return this
    }

    , next: function(event) {
      var active = this.$menu.find('.active').removeClass('active')
        , next = active.next()

      if (!next.length) {
        next = $(this.$menu.find('li')[0])
      }

      next.addClass('active')
    }

    , prev: function(event) {
      var active = this.$menu.find('.active').removeClass('active')
        , prev = active.prev()

      if (!prev.length) {
        prev = this.$menu.find('li').last()
      }

      prev.addClass('active')
    }

    , listen: function() {
      this.$element
        .on('focus', $.proxy(this.focus, this))
        .on('blur', $.proxy(this.blur, this))
        .on('keypress', $.proxy(this.keypress, this))
        .on('keyup', $.proxy(this.keyup, this))

      if (this.eventSupported('keydown')) {
        this.$element.on('keydown', $.proxy(this.keydown, this))
      }

      this.$menu
        .on('click', $.proxy(this.click, this))
        .on('mouseenter', 'li', $.proxy(this.mouseenter, this))
        .on('mouseleave', 'li', $.proxy(this.mouseleave, this))
    },

    destroy: function() {
      this.$element.off().removeData('typeahead');
      this.$menu.off();
    }

    , eventSupported: function(eventName) {
      var isSupported = eventName in this.$element
      if (!isSupported) {
        this.$element.setAttribute(eventName, 'return;')
        isSupported = typeof this.$element[eventName] === 'function'
      }
      return isSupported
    }

    , move: function(e) {
      if (!this.shown) return

      // grafana change, shift+left parenthesis
      if (e.shiftKey && e.keyCode === 40) {
        return;
      }

      switch (e.keyCode) {
        case 9: // tab
        case 13: // enter
        case 27: // escape
          e.preventDefault()
          break

        case 38: // up arrow
          e.preventDefault()
          this.prev()
          break

        case 40: // down arrow
          e.preventDefault()
          this.next()
          break
      }

      e.stopPropagation()
    }

    , keydown: function(e) {
      this.suppressKeyPressRepeat = ~$.inArray(e.keyCode, [40, 38, 9, 13, 27, 57])
      this.move(e)
    }

    , keypress: function(e) {
      if (this.suppressKeyPressRepeat) return
      this.move(e)
    }

    , keyup: function(e) {
      switch (e.keyCode) {
        case 40: // down arrow
        case 38: // up arrow
        case 16: // shift
        case 17: // ctrl
        case 18: // alt
          break

        case 9: // tab
        case 13: // enter
          if (!this.shown) return
          this.select()
          break

        case 27: // escape
          if (!this.shown) return
          this.hide()
          break

        default:
          this.lookup();
      }

      if (e.keyCode === 13 && typeof this.$menu.find('.active').attr('data-value') === 'undefined') {
        // CHANGE (rashidkpc). Enter was hit, nothing was selected from typeahead, submit form
        this.$element.submit();
      } else {
        e.stopPropagation()
        e.preventDefault()
      }

    }

    , focus: function(e) {
      this.focused = true
    }

    , blur: function(e) {
      this.focused = false
      if (!this.mousedover && this.shown) this.hide()
    }

    , click: function(e) {
      e.stopPropagation()
      e.preventDefault()
      this.select()
      this.$element.focus()
    }

    , mouseenter: function(e) {
      this.mousedover = true
      this.$menu.find('.active').removeClass('active')
      $(e.currentTarget).addClass('active')
    }

    , mouseleave: function(e) {
      this.mousedover = false
      if (!this.focused && this.shown) this.hide()
    }

  }


  /* TYPEAHEAD PLUGIN DEFINITION
   * =========================== */

  var old = $.fn.typeahead

  $.fn.typeahead = function(option) {
    return this.each(function() {
      var $this = $(this)
        , data = $this.data('typeahead')
        , options = typeof option == 'object' && option
      if (!data) $this.data('typeahead', (data = new Typeahead(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  $.fn.typeahead.defaults = {
    source: []
    , items: 8
    , menu: '<ul class="typeahead dropdown-menu"></ul>'
    , item: '<li><a href="#"></a></li>'
    , minLength: 1
  }

  $.fn.typeahead.Constructor = Typeahead


  /* TYPEAHEAD NO CONFLICT
   * =================== */

  $.fn.typeahead.noConflict = function() {
    $.fn.typeahead = old
    return this
  }


  /* TYPEAHEAD DATA-API
   * ================== */

  $(document).on('focus.typeahead.data-api', '[data-provide="typeahead"]', function(e) {
    var $this = $(this)
    if ($this.data('typeahead')) return
    $this.typeahead($this.data())
  })

}(window.jQuery);
/* ==========================================================
 * bootstrap-affix.js v2.3.2
 * http://getbootstrap.com/2.3.2/javascript.html#affix
 * ==========================================================
 * Copyright 2013 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */


!function($) {

  "use strict"; // jshint ;_;


  /* AFFIX CLASS DEFINITION
   * ====================== */

  var Affix = function(element, options) {
    this.options = $.extend({}, $.fn.affix.defaults, options)
    this.$window = $(window)
      .on('scroll.affix.data-api', $.proxy(this.checkPosition, this))
      .on('click.affix.data-api', $.proxy(function() { setTimeout($.proxy(this.checkPosition, this), 1) }, this))
    this.$element = $(element)
    this.checkPosition()
  }

  Affix.prototype.checkPosition = function() {
    if (!this.$element.is(':visible')) return

    var scrollHeight = $(document).height()
      , scrollTop = this.$window.scrollTop()
      , position = this.$element.offset()
      , offset = this.options.offset
      , offsetBottom = offset.bottom
      , offsetTop = offset.top
      , reset = 'affix affix-top affix-bottom'
      , affix

    if (typeof offset != 'object') offsetBottom = offsetTop = offset
    if (typeof offsetTop == 'function') offsetTop = offset.top()
    if (typeof offsetBottom == 'function') offsetBottom = offset.bottom()

    affix = this.unpin != null && (scrollTop + this.unpin <= position.top) ?
      false : offsetBottom != null && (position.top + this.$element.height() >= scrollHeight - offsetBottom) ?
        'bottom' : offsetTop != null && scrollTop <= offsetTop ?
          'top' : false

    if (this.affixed === affix) return

    this.affixed = affix
    this.unpin = affix == 'bottom' ? position.top - scrollTop : null

    this.$element.removeClass(reset).addClass('affix' + (affix ? '-' + affix : ''))
  }


  /* AFFIX PLUGIN DEFINITION
   * ======================= */

  var old = $.fn.affix

  $.fn.affix = function(option) {
    return this.each(function() {
      var $this = $(this)
        , data = $this.data('affix')
        , options = typeof option == 'object' && option
      if (!data) $this.data('affix', (data = new Affix(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  $.fn.affix.Constructor = Affix

  $.fn.affix.defaults = {
    offset: 0
  }


  /* AFFIX NO CONFLICT
   * ================= */

  $.fn.affix.noConflict = function() {
    $.fn.affix = old
    return this
  }


  /* AFFIX DATA-API
   * ============== */

  $(window).on('load', function() {
    $('[data-spy="affix"]').each(function() {
      var $spy = $(this)
        , data = $spy.data()

      data.offset = data.offset || {}

      data.offsetBottom && (data.offset.bottom = data.offsetBottom)
      data.offsetTop && (data.offset.top = data.offsetTop)

      $spy.affix(data)
    })
  })


}(window.jQuery);
