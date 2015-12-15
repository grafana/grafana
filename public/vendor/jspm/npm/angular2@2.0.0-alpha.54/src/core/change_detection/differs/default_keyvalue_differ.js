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
var collection_1 = require('../../../facade/collection');
var lang_1 = require('../../../facade/lang');
var exceptions_1 = require('../../../facade/exceptions');
var DefaultKeyValueDifferFactory = (function() {
  function DefaultKeyValueDifferFactory() {}
  DefaultKeyValueDifferFactory.prototype.supports = function(obj) {
    return obj instanceof Map || lang_1.isJsObject(obj);
  };
  DefaultKeyValueDifferFactory.prototype.create = function(cdRef) {
    return new DefaultKeyValueDiffer();
  };
  DefaultKeyValueDifferFactory = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [])], DefaultKeyValueDifferFactory);
  return DefaultKeyValueDifferFactory;
})();
exports.DefaultKeyValueDifferFactory = DefaultKeyValueDifferFactory;
var DefaultKeyValueDiffer = (function() {
  function DefaultKeyValueDiffer() {
    this._records = new Map();
    this._mapHead = null;
    this._previousMapHead = null;
    this._changesHead = null;
    this._changesTail = null;
    this._additionsHead = null;
    this._additionsTail = null;
    this._removalsHead = null;
    this._removalsTail = null;
  }
  Object.defineProperty(DefaultKeyValueDiffer.prototype, "isDirty", {
    get: function() {
      return this._additionsHead !== null || this._changesHead !== null || this._removalsHead !== null;
    },
    enumerable: true,
    configurable: true
  });
  DefaultKeyValueDiffer.prototype.forEachItem = function(fn) {
    var record;
    for (record = this._mapHead; record !== null; record = record._next) {
      fn(record);
    }
  };
  DefaultKeyValueDiffer.prototype.forEachPreviousItem = function(fn) {
    var record;
    for (record = this._previousMapHead; record !== null; record = record._nextPrevious) {
      fn(record);
    }
  };
  DefaultKeyValueDiffer.prototype.forEachChangedItem = function(fn) {
    var record;
    for (record = this._changesHead; record !== null; record = record._nextChanged) {
      fn(record);
    }
  };
  DefaultKeyValueDiffer.prototype.forEachAddedItem = function(fn) {
    var record;
    for (record = this._additionsHead; record !== null; record = record._nextAdded) {
      fn(record);
    }
  };
  DefaultKeyValueDiffer.prototype.forEachRemovedItem = function(fn) {
    var record;
    for (record = this._removalsHead; record !== null; record = record._nextRemoved) {
      fn(record);
    }
  };
  DefaultKeyValueDiffer.prototype.diff = function(map) {
    if (lang_1.isBlank(map))
      map = collection_1.MapWrapper.createFromPairs([]);
    if (!(map instanceof Map || lang_1.isJsObject(map))) {
      throw new exceptions_1.BaseException("Error trying to diff '" + map + "'");
    }
    if (this.check(map)) {
      return this;
    } else {
      return null;
    }
  };
  DefaultKeyValueDiffer.prototype.onDestroy = function() {};
  DefaultKeyValueDiffer.prototype.check = function(map) {
    var _this = this;
    this._reset();
    var records = this._records;
    var oldSeqRecord = this._mapHead;
    var lastOldSeqRecord = null;
    var lastNewSeqRecord = null;
    var seqChanged = false;
    this._forEach(map, function(value, key) {
      var newSeqRecord;
      if (oldSeqRecord !== null && key === oldSeqRecord.key) {
        newSeqRecord = oldSeqRecord;
        if (!lang_1.looseIdentical(value, oldSeqRecord.currentValue)) {
          oldSeqRecord.previousValue = oldSeqRecord.currentValue;
          oldSeqRecord.currentValue = value;
          _this._addToChanges(oldSeqRecord);
        }
      } else {
        seqChanged = true;
        if (oldSeqRecord !== null) {
          oldSeqRecord._next = null;
          _this._removeFromSeq(lastOldSeqRecord, oldSeqRecord);
          _this._addToRemovals(oldSeqRecord);
        }
        if (records.has(key)) {
          newSeqRecord = records.get(key);
        } else {
          newSeqRecord = new KVChangeRecord(key);
          records.set(key, newSeqRecord);
          newSeqRecord.currentValue = value;
          _this._addToAdditions(newSeqRecord);
        }
      }
      if (seqChanged) {
        if (_this._isInRemovals(newSeqRecord)) {
          _this._removeFromRemovals(newSeqRecord);
        }
        if (lastNewSeqRecord == null) {
          _this._mapHead = newSeqRecord;
        } else {
          lastNewSeqRecord._next = newSeqRecord;
        }
      }
      lastOldSeqRecord = oldSeqRecord;
      lastNewSeqRecord = newSeqRecord;
      oldSeqRecord = oldSeqRecord === null ? null : oldSeqRecord._next;
    });
    this._truncate(lastOldSeqRecord, oldSeqRecord);
    return this.isDirty;
  };
  DefaultKeyValueDiffer.prototype._reset = function() {
    if (this.isDirty) {
      var record;
      for (record = this._previousMapHead = this._mapHead; record !== null; record = record._next) {
        record._nextPrevious = record._next;
      }
      for (record = this._changesHead; record !== null; record = record._nextChanged) {
        record.previousValue = record.currentValue;
      }
      for (record = this._additionsHead; record != null; record = record._nextAdded) {
        record.previousValue = record.currentValue;
      }
      this._changesHead = this._changesTail = null;
      this._additionsHead = this._additionsTail = null;
      this._removalsHead = this._removalsTail = null;
    }
  };
  DefaultKeyValueDiffer.prototype._truncate = function(lastRecord, record) {
    while (record !== null) {
      if (lastRecord === null) {
        this._mapHead = null;
      } else {
        lastRecord._next = null;
      }
      var nextRecord = record._next;
      this._addToRemovals(record);
      lastRecord = record;
      record = nextRecord;
    }
    for (var rec = this._removalsHead; rec !== null; rec = rec._nextRemoved) {
      rec.previousValue = rec.currentValue;
      rec.currentValue = null;
      this._records.delete(rec.key);
    }
  };
  DefaultKeyValueDiffer.prototype._isInRemovals = function(record) {
    return record === this._removalsHead || record._nextRemoved !== null || record._prevRemoved !== null;
  };
  DefaultKeyValueDiffer.prototype._addToRemovals = function(record) {
    if (this._removalsHead === null) {
      this._removalsHead = this._removalsTail = record;
    } else {
      this._removalsTail._nextRemoved = record;
      record._prevRemoved = this._removalsTail;
      this._removalsTail = record;
    }
  };
  DefaultKeyValueDiffer.prototype._removeFromSeq = function(prev, record) {
    var next = record._next;
    if (prev === null) {
      this._mapHead = next;
    } else {
      prev._next = next;
    }
  };
  DefaultKeyValueDiffer.prototype._removeFromRemovals = function(record) {
    var prev = record._prevRemoved;
    var next = record._nextRemoved;
    if (prev === null) {
      this._removalsHead = next;
    } else {
      prev._nextRemoved = next;
    }
    if (next === null) {
      this._removalsTail = prev;
    } else {
      next._prevRemoved = prev;
    }
    record._prevRemoved = record._nextRemoved = null;
  };
  DefaultKeyValueDiffer.prototype._addToAdditions = function(record) {
    if (this._additionsHead === null) {
      this._additionsHead = this._additionsTail = record;
    } else {
      this._additionsTail._nextAdded = record;
      this._additionsTail = record;
    }
  };
  DefaultKeyValueDiffer.prototype._addToChanges = function(record) {
    if (this._changesHead === null) {
      this._changesHead = this._changesTail = record;
    } else {
      this._changesTail._nextChanged = record;
      this._changesTail = record;
    }
  };
  DefaultKeyValueDiffer.prototype.toString = function() {
    var items = [];
    var previous = [];
    var changes = [];
    var additions = [];
    var removals = [];
    var record;
    for (record = this._mapHead; record !== null; record = record._next) {
      items.push(lang_1.stringify(record));
    }
    for (record = this._previousMapHead; record !== null; record = record._nextPrevious) {
      previous.push(lang_1.stringify(record));
    }
    for (record = this._changesHead; record !== null; record = record._nextChanged) {
      changes.push(lang_1.stringify(record));
    }
    for (record = this._additionsHead; record !== null; record = record._nextAdded) {
      additions.push(lang_1.stringify(record));
    }
    for (record = this._removalsHead; record !== null; record = record._nextRemoved) {
      removals.push(lang_1.stringify(record));
    }
    return "map: " + items.join(', ') + "\n" + "previous: " + previous.join(', ') + "\n" + "additions: " + additions.join(', ') + "\n" + "changes: " + changes.join(', ') + "\n" + "removals: " + removals.join(', ') + "\n";
  };
  DefaultKeyValueDiffer.prototype._forEach = function(obj, fn) {
    if (obj instanceof Map) {
      obj.forEach(fn);
    } else {
      collection_1.StringMapWrapper.forEach(obj, fn);
    }
  };
  return DefaultKeyValueDiffer;
})();
exports.DefaultKeyValueDiffer = DefaultKeyValueDiffer;
var KVChangeRecord = (function() {
  function KVChangeRecord(key) {
    this.key = key;
    this.previousValue = null;
    this.currentValue = null;
    this._nextPrevious = null;
    this._next = null;
    this._nextAdded = null;
    this._nextRemoved = null;
    this._prevRemoved = null;
    this._nextChanged = null;
  }
  KVChangeRecord.prototype.toString = function() {
    return lang_1.looseIdentical(this.previousValue, this.currentValue) ? lang_1.stringify(this.key) : (lang_1.stringify(this.key) + '[' + lang_1.stringify(this.previousValue) + '->' + lang_1.stringify(this.currentValue) + ']');
  };
  return KVChangeRecord;
})();
exports.KVChangeRecord = KVChangeRecord;
