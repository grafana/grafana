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
var lang_1 = require('../../../facade/lang');
var exceptions_1 = require('../../../facade/exceptions');
var collection_1 = require('../../../facade/collection');
var lang_2 = require('../../../facade/lang');
var DefaultIterableDifferFactory = (function() {
  function DefaultIterableDifferFactory() {}
  DefaultIterableDifferFactory.prototype.supports = function(obj) {
    return collection_1.isListLikeIterable(obj);
  };
  DefaultIterableDifferFactory.prototype.create = function(cdRef) {
    return new DefaultIterableDiffer();
  };
  DefaultIterableDifferFactory = __decorate([lang_1.CONST(), __metadata('design:paramtypes', [])], DefaultIterableDifferFactory);
  return DefaultIterableDifferFactory;
})();
exports.DefaultIterableDifferFactory = DefaultIterableDifferFactory;
var DefaultIterableDiffer = (function() {
  function DefaultIterableDiffer() {
    this._collection = null;
    this._length = null;
    this._linkedRecords = null;
    this._unlinkedRecords = null;
    this._previousItHead = null;
    this._itHead = null;
    this._itTail = null;
    this._additionsHead = null;
    this._additionsTail = null;
    this._movesHead = null;
    this._movesTail = null;
    this._removalsHead = null;
    this._removalsTail = null;
  }
  Object.defineProperty(DefaultIterableDiffer.prototype, "collection", {
    get: function() {
      return this._collection;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(DefaultIterableDiffer.prototype, "length", {
    get: function() {
      return this._length;
    },
    enumerable: true,
    configurable: true
  });
  DefaultIterableDiffer.prototype.forEachItem = function(fn) {
    var record;
    for (record = this._itHead; record !== null; record = record._next) {
      fn(record);
    }
  };
  DefaultIterableDiffer.prototype.forEachPreviousItem = function(fn) {
    var record;
    for (record = this._previousItHead; record !== null; record = record._nextPrevious) {
      fn(record);
    }
  };
  DefaultIterableDiffer.prototype.forEachAddedItem = function(fn) {
    var record;
    for (record = this._additionsHead; record !== null; record = record._nextAdded) {
      fn(record);
    }
  };
  DefaultIterableDiffer.prototype.forEachMovedItem = function(fn) {
    var record;
    for (record = this._movesHead; record !== null; record = record._nextMoved) {
      fn(record);
    }
  };
  DefaultIterableDiffer.prototype.forEachRemovedItem = function(fn) {
    var record;
    for (record = this._removalsHead; record !== null; record = record._nextRemoved) {
      fn(record);
    }
  };
  DefaultIterableDiffer.prototype.diff = function(collection) {
    if (lang_2.isBlank(collection))
      collection = [];
    if (!collection_1.isListLikeIterable(collection)) {
      throw new exceptions_1.BaseException("Error trying to diff '" + collection + "'");
    }
    if (this.check(collection)) {
      return this;
    } else {
      return null;
    }
  };
  DefaultIterableDiffer.prototype.onDestroy = function() {};
  DefaultIterableDiffer.prototype.check = function(collection) {
    var _this = this;
    this._reset();
    var record = this._itHead;
    var mayBeDirty = false;
    var index;
    var item;
    if (lang_2.isArray(collection)) {
      var list = collection;
      this._length = collection.length;
      for (index = 0; index < this._length; index++) {
        item = list[index];
        if (record === null || !lang_2.looseIdentical(record.item, item)) {
          record = this._mismatch(record, item, index);
          mayBeDirty = true;
        } else if (mayBeDirty) {
          record = this._verifyReinsertion(record, item, index);
        }
        record = record._next;
      }
    } else {
      index = 0;
      collection_1.iterateListLike(collection, function(item) {
        if (record === null || !lang_2.looseIdentical(record.item, item)) {
          record = _this._mismatch(record, item, index);
          mayBeDirty = true;
        } else if (mayBeDirty) {
          record = _this._verifyReinsertion(record, item, index);
        }
        record = record._next;
        index++;
      });
      this._length = index;
    }
    this._truncate(record);
    this._collection = collection;
    return this.isDirty;
  };
  Object.defineProperty(DefaultIterableDiffer.prototype, "isDirty", {
    get: function() {
      return this._additionsHead !== null || this._movesHead !== null || this._removalsHead !== null;
    },
    enumerable: true,
    configurable: true
  });
  DefaultIterableDiffer.prototype._reset = function() {
    if (this.isDirty) {
      var record;
      var nextRecord;
      for (record = this._previousItHead = this._itHead; record !== null; record = record._next) {
        record._nextPrevious = record._next;
      }
      for (record = this._additionsHead; record !== null; record = record._nextAdded) {
        record.previousIndex = record.currentIndex;
      }
      this._additionsHead = this._additionsTail = null;
      for (record = this._movesHead; record !== null; record = nextRecord) {
        record.previousIndex = record.currentIndex;
        nextRecord = record._nextMoved;
      }
      this._movesHead = this._movesTail = null;
      this._removalsHead = this._removalsTail = null;
    }
  };
  DefaultIterableDiffer.prototype._mismatch = function(record, item, index) {
    var previousRecord;
    if (record === null) {
      previousRecord = this._itTail;
    } else {
      previousRecord = record._prev;
      this._remove(record);
    }
    record = this._linkedRecords === null ? null : this._linkedRecords.get(item, index);
    if (record !== null) {
      this._moveAfter(record, previousRecord, index);
    } else {
      record = this._unlinkedRecords === null ? null : this._unlinkedRecords.get(item);
      if (record !== null) {
        this._reinsertAfter(record, previousRecord, index);
      } else {
        record = this._addAfter(new CollectionChangeRecord(item), previousRecord, index);
      }
    }
    return record;
  };
  DefaultIterableDiffer.prototype._verifyReinsertion = function(record, item, index) {
    var reinsertRecord = this._unlinkedRecords === null ? null : this._unlinkedRecords.get(item);
    if (reinsertRecord !== null) {
      record = this._reinsertAfter(reinsertRecord, record._prev, index);
    } else if (record.currentIndex != index) {
      record.currentIndex = index;
      this._addToMoves(record, index);
    }
    return record;
  };
  DefaultIterableDiffer.prototype._truncate = function(record) {
    while (record !== null) {
      var nextRecord = record._next;
      this._addToRemovals(this._unlink(record));
      record = nextRecord;
    }
    if (this._unlinkedRecords !== null) {
      this._unlinkedRecords.clear();
    }
    if (this._additionsTail !== null) {
      this._additionsTail._nextAdded = null;
    }
    if (this._movesTail !== null) {
      this._movesTail._nextMoved = null;
    }
    if (this._itTail !== null) {
      this._itTail._next = null;
    }
    if (this._removalsTail !== null) {
      this._removalsTail._nextRemoved = null;
    }
  };
  DefaultIterableDiffer.prototype._reinsertAfter = function(record, prevRecord, index) {
    if (this._unlinkedRecords !== null) {
      this._unlinkedRecords.remove(record);
    }
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
    this._insertAfter(record, prevRecord, index);
    this._addToMoves(record, index);
    return record;
  };
  DefaultIterableDiffer.prototype._moveAfter = function(record, prevRecord, index) {
    this._unlink(record);
    this._insertAfter(record, prevRecord, index);
    this._addToMoves(record, index);
    return record;
  };
  DefaultIterableDiffer.prototype._addAfter = function(record, prevRecord, index) {
    this._insertAfter(record, prevRecord, index);
    if (this._additionsTail === null) {
      this._additionsTail = this._additionsHead = record;
    } else {
      this._additionsTail = this._additionsTail._nextAdded = record;
    }
    return record;
  };
  DefaultIterableDiffer.prototype._insertAfter = function(record, prevRecord, index) {
    var next = prevRecord === null ? this._itHead : prevRecord._next;
    record._next = next;
    record._prev = prevRecord;
    if (next === null) {
      this._itTail = record;
    } else {
      next._prev = record;
    }
    if (prevRecord === null) {
      this._itHead = record;
    } else {
      prevRecord._next = record;
    }
    if (this._linkedRecords === null) {
      this._linkedRecords = new _DuplicateMap();
    }
    this._linkedRecords.put(record);
    record.currentIndex = index;
    return record;
  };
  DefaultIterableDiffer.prototype._remove = function(record) {
    return this._addToRemovals(this._unlink(record));
  };
  DefaultIterableDiffer.prototype._unlink = function(record) {
    if (this._linkedRecords !== null) {
      this._linkedRecords.remove(record);
    }
    var prev = record._prev;
    var next = record._next;
    if (prev === null) {
      this._itHead = next;
    } else {
      prev._next = next;
    }
    if (next === null) {
      this._itTail = prev;
    } else {
      next._prev = prev;
    }
    return record;
  };
  DefaultIterableDiffer.prototype._addToMoves = function(record, toIndex) {
    if (record.previousIndex === toIndex) {
      return record;
    }
    if (this._movesTail === null) {
      this._movesTail = this._movesHead = record;
    } else {
      this._movesTail = this._movesTail._nextMoved = record;
    }
    return record;
  };
  DefaultIterableDiffer.prototype._addToRemovals = function(record) {
    if (this._unlinkedRecords === null) {
      this._unlinkedRecords = new _DuplicateMap();
    }
    this._unlinkedRecords.put(record);
    record.currentIndex = null;
    record._nextRemoved = null;
    if (this._removalsTail === null) {
      this._removalsTail = this._removalsHead = record;
      record._prevRemoved = null;
    } else {
      record._prevRemoved = this._removalsTail;
      this._removalsTail = this._removalsTail._nextRemoved = record;
    }
    return record;
  };
  DefaultIterableDiffer.prototype.toString = function() {
    var record;
    var list = [];
    for (record = this._itHead; record !== null; record = record._next) {
      list.push(record);
    }
    var previous = [];
    for (record = this._previousItHead; record !== null; record = record._nextPrevious) {
      previous.push(record);
    }
    var additions = [];
    for (record = this._additionsHead; record !== null; record = record._nextAdded) {
      additions.push(record);
    }
    var moves = [];
    for (record = this._movesHead; record !== null; record = record._nextMoved) {
      moves.push(record);
    }
    var removals = [];
    for (record = this._removalsHead; record !== null; record = record._nextRemoved) {
      removals.push(record);
    }
    return "collection: " + list.join(', ') + "\n" + "previous: " + previous.join(', ') + "\n" + "additions: " + additions.join(', ') + "\n" + "moves: " + moves.join(', ') + "\n" + "removals: " + removals.join(', ') + "\n";
  };
  return DefaultIterableDiffer;
})();
exports.DefaultIterableDiffer = DefaultIterableDiffer;
var CollectionChangeRecord = (function() {
  function CollectionChangeRecord(item) {
    this.item = item;
    this.currentIndex = null;
    this.previousIndex = null;
    this._nextPrevious = null;
    this._prev = null;
    this._next = null;
    this._prevDup = null;
    this._nextDup = null;
    this._prevRemoved = null;
    this._nextRemoved = null;
    this._nextAdded = null;
    this._nextMoved = null;
  }
  CollectionChangeRecord.prototype.toString = function() {
    return this.previousIndex === this.currentIndex ? lang_2.stringify(this.item) : lang_2.stringify(this.item) + '[' + lang_2.stringify(this.previousIndex) + '->' + lang_2.stringify(this.currentIndex) + ']';
  };
  return CollectionChangeRecord;
})();
exports.CollectionChangeRecord = CollectionChangeRecord;
var _DuplicateItemRecordList = (function() {
  function _DuplicateItemRecordList() {
    this._head = null;
    this._tail = null;
  }
  _DuplicateItemRecordList.prototype.add = function(record) {
    if (this._head === null) {
      this._head = this._tail = record;
      record._nextDup = null;
      record._prevDup = null;
    } else {
      this._tail._nextDup = record;
      record._prevDup = this._tail;
      record._nextDup = null;
      this._tail = record;
    }
  };
  _DuplicateItemRecordList.prototype.get = function(item, afterIndex) {
    var record;
    for (record = this._head; record !== null; record = record._nextDup) {
      if ((afterIndex === null || afterIndex < record.currentIndex) && lang_2.looseIdentical(record.item, item)) {
        return record;
      }
    }
    return null;
  };
  _DuplicateItemRecordList.prototype.remove = function(record) {
    var prev = record._prevDup;
    var next = record._nextDup;
    if (prev === null) {
      this._head = next;
    } else {
      prev._nextDup = next;
    }
    if (next === null) {
      this._tail = prev;
    } else {
      next._prevDup = prev;
    }
    return this._head === null;
  };
  return _DuplicateItemRecordList;
})();
var _DuplicateMap = (function() {
  function _DuplicateMap() {
    this.map = new Map();
  }
  _DuplicateMap.prototype.put = function(record) {
    var key = lang_2.getMapKey(record.item);
    var duplicates = this.map.get(key);
    if (!lang_2.isPresent(duplicates)) {
      duplicates = new _DuplicateItemRecordList();
      this.map.set(key, duplicates);
    }
    duplicates.add(record);
  };
  _DuplicateMap.prototype.get = function(value, afterIndex) {
    if (afterIndex === void 0) {
      afterIndex = null;
    }
    var key = lang_2.getMapKey(value);
    var recordList = this.map.get(key);
    return lang_2.isBlank(recordList) ? null : recordList.get(value, afterIndex);
  };
  _DuplicateMap.prototype.remove = function(record) {
    var key = lang_2.getMapKey(record.item);
    var recordList = this.map.get(key);
    if (recordList.remove(record)) {
      this.map.delete(key);
    }
    return record;
  };
  Object.defineProperty(_DuplicateMap.prototype, "isEmpty", {
    get: function() {
      return this.map.size === 0;
    },
    enumerable: true,
    configurable: true
  });
  _DuplicateMap.prototype.clear = function() {
    this.map.clear();
  };
  _DuplicateMap.prototype.toString = function() {
    return '_DuplicateMap(' + lang_2.stringify(this.map) + ')';
  };
  return _DuplicateMap;
})();
