+++
draft = "false"
date = "yyyy-mm-dd"
title = "Title in sentence case"
description = "Description in title case"
keywords = ["grafana", "enter", "keywords", "here"]
type = "docs"
[menu.docs]
name = "Name of topic"
identifier = "identifier"
parent = "menu parent"
weight = 100
+++

# Task

A *task* topic is intended for a procedure that describes how to accomplish a task. It lists a series of steps that users follow to produce an intended outcome. It tells the reader *how* to do something. [Install Grafana plugins](https://grafana.com/docs/grafana/latest/plugins/installation/) and [Playlist](https://grafana.com/docs/grafana/latest/reference/playlist/) are examples of task topics. Playlist includes a small amount of concept information in the introduction, which is appropriate.

Always include an introduction of a short paragraph or two to explain what the task is for, perhaps give the reader an idea of what the outcome will be.

In most cases, each topic should only contain one task. If you have several very short, related tasks, then you might combine them into one topic.

In the case of a long task, then you probably won't need any headings except for the h1 at the top of the page.

1. Start with step one.
1. Use second-person imperative tense.
1. Basically, "You, do this" with every sentence.
1. Do not use the third-person "user" for steps you want the reader ("you") to perform.
1. Write steps that contain one action, possibly two related actions, such as copy and paste a thing or save and quit the program.
   If a sentence is not telling the reader to do something, then it is not a step. You can use nested images or paragraphs like this one to add information if necessary.

In many cases, you should tell the reader what the outcome should be so that they know when they are done.

## One-step task

Some tasks are so short, they only contain one step.

Write one-step tasks as simple sentences, not as unordered lists or numbered lists.

## Short task

Short tasks can be grouped. How short constitutes "short" is a judgment call based on number of steps and how long individual steps are.

1. Use your judgment.
2. Ask your coworkers or someone on the Comm team for advice if you aren't sure.

## Next steps

If the task you are writing leads naturally to one or more other tasks, then include links after the task to help the reader figure out where to go next.

Thanks to internet search engines, every page in the documentation could be page one. Pretend you are explaining your task to a new Grafana user who just walked in off the street.

## Testing

It is a good practice to have someone else test the task you have written. If they can successfully complete the task using *only* what the steps you have written, not guessing or using their inherent knowledge, then your task has passed the test. However, it is very common to find you have skipped steps, because *you* are very familiar with Grafana and the topic you are explaining.

New users or people from other teams are very helpful for these tests.
