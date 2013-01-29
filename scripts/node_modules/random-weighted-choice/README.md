# Random Weighted Choice

[![Build Status](https://secure.travis-ci.org/parmentf/random-weighted-choice.png?branch=master)](http://travis-ci.org/parmentf/random-weighted-choice)

Node.js module to make a random choice among weighted elements of table.

## Installation

With [npm](http://npmjs.org) do:

    $ npm install random-weighted-choice


## Examples

Although you can add several times the same id

    var rwc = require('random-weighted-choice');
    var table = [
        { weight: 1, id: "item1"} // Element 1
      , { weight: 1, id: "item2"} // Element 2
      , { weight: 4, id: "item3"} // Element with a 4 times likelihood
      , { weight: 2, id: "item1"} // Element 1, weight added with 2 => 3
    ];
    var choosenItem = rwc(table);
    var choosenUnlikely = rwc(table, 100); // The last shall be first
    var choosenDeterministically = rwc(table, 0);

It is better to not use the same twice, if you want a temperature other than
the default one (50).

    var rwc = require('random-weighted-choice');
    var table = [
        { weight: 1, id: "item1"} // Element 1
      , { weight: 1, id: "item2"} // Element 2
      , { weight: 4, id: "item3"} // Element with a 4 times likelihood
      , { weight: 2, id: "item4"} // Element 4
      , { weight: 2, id: "item5"}
    ];
    var choosenItem = rwc(table);
    var choosenUnlikely = rwc(table, 100); // The last shall be first
    var choosenDeterministically = rwc(table, 0);

Without temperature (second parameter) or a 50 value, likelihoods are:

    { item1: 10%, item2: 10%, item3: 40%, item4: 20%, item5: 20% }

With a temperature value of 100:

    { item1: 30%, item2: 30%, item3: 0%, item4: 20%, item5: 20% }

With a temperature value of 0, modified weights are:

    { item1: 0, item2: 0, item3: 8, item4: 2, item5: 2 }

## Usage

### random-weighted-choice(Array table, Number temperature = 50)

Return the ``id`` of the chosen item from ``table``.

The ``table`` parameter should contain an Array. Each item of that Array must
bean object, with at least ``weight`` and ``id`` property.

Weight values are relative to each other. They are integers.

When the sum of the weight values is ``null``, ``null`` is returned (can't choose).

When the Array is empty, ``null`` is returned.

More explanations on how it works on [Everything2](http://everything2.com/title/Blackboard+temperature).

## Also

* https://github.com/Schoonology/weighted