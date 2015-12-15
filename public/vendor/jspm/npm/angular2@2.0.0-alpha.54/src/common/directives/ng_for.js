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
var core_1 = require('../../../core');
var lang_1 = require('../../facade/lang');
var NgFor = (function() {
  function NgFor(_viewContainer, _templateRef, _iterableDiffers, _cdr) {
    this._viewContainer = _viewContainer;
    this._templateRef = _templateRef;
    this._iterableDiffers = _iterableDiffers;
    this._cdr = _cdr;
  }
  Object.defineProperty(NgFor.prototype, "ngForOf", {
    set: function(value) {
      this._ngForOf = value;
      if (lang_1.isBlank(this._differ) && lang_1.isPresent(value)) {
        this._differ = this._iterableDiffers.find(value).create(this._cdr);
      }
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgFor.prototype, "ngForTemplate", {
    set: function(value) {
      if (lang_1.isPresent(value)) {
        this._templateRef = value;
      }
    },
    enumerable: true,
    configurable: true
  });
  NgFor.prototype.ngDoCheck = function() {
    if (lang_1.isPresent(this._differ)) {
      var changes = this._differ.diff(this._ngForOf);
      if (lang_1.isPresent(changes))
        this._applyChanges(changes);
    }
  };
  NgFor.prototype._applyChanges = function(changes) {
    var recordViewTuples = [];
    changes.forEachRemovedItem(function(removedRecord) {
      return recordViewTuples.push(new RecordViewTuple(removedRecord, null));
    });
    changes.forEachMovedItem(function(movedRecord) {
      return recordViewTuples.push(new RecordViewTuple(movedRecord, null));
    });
    var insertTuples = this._bulkRemove(recordViewTuples);
    changes.forEachAddedItem(function(addedRecord) {
      return insertTuples.push(new RecordViewTuple(addedRecord, null));
    });
    this._bulkInsert(insertTuples);
    for (var i = 0; i < insertTuples.length; i++) {
      this._perViewChange(insertTuples[i].view, insertTuples[i].record);
    }
    for (var i = 0,
        ilen = this._viewContainer.length; i < ilen; i++) {
      this._viewContainer.get(i).setLocal('last', i === ilen - 1);
    }
  };
  NgFor.prototype._perViewChange = function(view, record) {
    view.setLocal('\$implicit', record.item);
    view.setLocal('index', record.currentIndex);
    view.setLocal('even', (record.currentIndex % 2 == 0));
    view.setLocal('odd', (record.currentIndex % 2 == 1));
  };
  NgFor.prototype._bulkRemove = function(tuples) {
    tuples.sort(function(a, b) {
      return a.record.previousIndex - b.record.previousIndex;
    });
    var movedTuples = [];
    for (var i = tuples.length - 1; i >= 0; i--) {
      var tuple = tuples[i];
      if (lang_1.isPresent(tuple.record.currentIndex)) {
        tuple.view = this._viewContainer.detach(tuple.record.previousIndex);
        movedTuples.push(tuple);
      } else {
        this._viewContainer.remove(tuple.record.previousIndex);
      }
    }
    return movedTuples;
  };
  NgFor.prototype._bulkInsert = function(tuples) {
    tuples.sort(function(a, b) {
      return a.record.currentIndex - b.record.currentIndex;
    });
    for (var i = 0; i < tuples.length; i++) {
      var tuple = tuples[i];
      if (lang_1.isPresent(tuple.view)) {
        this._viewContainer.insert(tuple.view, tuple.record.currentIndex);
      } else {
        tuple.view = this._viewContainer.createEmbeddedView(this._templateRef, tuple.record.currentIndex);
      }
    }
    return tuples;
  };
  NgFor = __decorate([core_1.Directive({
    selector: '[ngFor][ngForOf]',
    inputs: ['ngForOf', 'ngForTemplate']
  }), __metadata('design:paramtypes', [core_1.ViewContainerRef, core_1.TemplateRef, core_1.IterableDiffers, core_1.ChangeDetectorRef])], NgFor);
  return NgFor;
})();
exports.NgFor = NgFor;
var RecordViewTuple = (function() {
  function RecordViewTuple(record, view) {
    this.record = record;
    this.view = view;
  }
  return RecordViewTuple;
})();
